import { Component, HostListener, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DealApiService, BackendItem, BackendParty, SaveDealBackendRequest } from '../../core/services/deal-api.service';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { WhatsAppBrokerService, DealPayload } from '../../core/services/whatsapp.service';

export interface Party {
  id: number;
  firmName: string;
  contactPerson: string;
  mobile: string;
  city: string;
  currentDue: number;
  role: 'SELLER' | 'BUYER' | 'BOTH';
}

@Component({
  selector: 'app-deal-entry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './deal-entry.component.html',
})
export class DealEntryComponent implements OnInit {
  private fb = inject(FormBuilder);
  private waService = inject(WhatsAppBrokerService);
  private pdfExportService = inject(PdfExportService);
  private dealApi = inject(DealApiService);

  dealForm!: FormGroup;

  isLoadingParties = signal<boolean>(false);
  isLoadingItems = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');
  nextDealNumber = signal<string>('5001');

  parties = signal<Party[]>([]);
  items = signal<BackendItem[]>([]);

  sellerSearch = signal<string>('');
  buyerSearch = signal<string>('');
  sellerDropdownOpen = signal<boolean>(false);
  buyerDropdownOpen = signal<boolean>(false);

  selectedSeller = signal<Party | null>(null);
  selectedBuyer = signal<Party | null>(null);

  sellerBrokerageAmount = signal<number>(0);
  buyerBrokerageAmount = signal<number>(0);
  totalBrokerageRevenue = computed(() => this.sellerBrokerageAmount() + this.buyerBrokerageAmount());

  ngOnInit(): void {
    this.initForm();
    this.setupLiveCalculations();
    this.loadNextDealNumber();
    this.loadPartiesFromBackend();
    this.loadItems();
  }

  loadNextDealNumber(): void {
    this.dealApi.getNextDealNumber().subscribe({
      next: ({ nextDealNo }) => {
        this.nextDealNumber.set(nextDealNo || '5001');
        this.dealForm.patchValue({ dealNo: nextDealNo || '5001' }, { emitEvent: false });
      },
      error: () => {
        this.dealApi.getDealReport('1900-01-01', '2999-12-31').subscribe({
          next: (deals) => {
            const latestNumber = deals.reduce((latest, deal) => {
              const numericDealNo = Number(String(deal.dealNo).replace(/\D/g, ''));
              return Number.isFinite(numericDealNo) ? Math.max(latest, numericDealNo) : latest;
            }, 5000);
            const nextDealNo = String(latestNumber + 1).padStart(4, '0');
            this.nextDealNumber.set(nextDealNo);
            this.dealForm.patchValue({ dealNo: nextDealNo }, { emitEvent: false });
          },
          error: () => this.dealForm.patchValue({ dealNo: this.nextDealNumber() }, { emitEvent: false }),
        });
      },
    });
  }

  loadItems(): void {
    this.isLoadingItems.set(true);
    this.dealApi.getItems().subscribe({
      next: (items) => {
        this.items.set(items);
        const selected = items.find((item) => item.name === this.dealForm.get('itemQuality')?.value) || items[0];
        if (selected) this.dealForm.patchValue({ itemQuality: selected.name, unit: selected.defaultUnit });
        this.isLoadingItems.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load Item Master. Add items and check the backend connection.');
        this.isLoadingItems.set(false);
      },
    });
  }

  selectItem(name: string): void {
    const selected = this.items().find((item) => item.name === name);
    if (selected) this.dealForm.patchValue({ itemQuality: selected.name, unit: selected.defaultUnit });
  }

  loadPartiesFromBackend(): void {
    this.isLoadingParties.set(true);
    this.errorMessage.set('');

    this.dealApi.getParties().subscribe({
      next: (data: BackendParty[]) => {
        this.parties.set(
          data.map((p) => ({
            id: Number(p.id),
            firmName: p.firmName,
            contactPerson: p.contactPerson || '',
            mobile: p.mobile,
            city: p.city || '',
            currentDue: Number(p.currentDue) || 0,
            role: p.role,
          })),
        );
        this.isLoadingParties.set(false);
      },
      error: () => {
        this.isLoadingParties.set(false);
        this.errorMessage.set('Could not connect to PostgreSQL. Please check the backend server on port 3000.');
      },
    });
  }

  private initForm(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.dealForm = this.fb.group({
      dealNo: [this.nextDealNumber(), Validators.required],
      dealDate: [today, Validators.required],
      sellerId: [null, Validators.required],
      buyerId: [null, Validators.required],
      itemQuality: ['POHA REGULAR', Validators.required],
      quantity: [25, [Validators.required, Validators.min(0.01)]],
      unit: ['TON', Validators.required],
      dealRate: [2550, [Validators.required, Validators.min(1)]],
      motor: [0, [Validators.min(0), Validators.max(100), Validators.pattern(/^\d+$/)]],
      remarks: [''],
      sellerBrokerageRate: [120, [Validators.required, Validators.min(0)]],
      buyerBrokerageRate: [100, [Validators.required, Validators.min(0)]],
      autoOpenWhatsApp: [true],
      autoGeneratePdf: [true],
    });
  }

  private setupLiveCalculations(): void {
    this.dealForm.valueChanges.subscribe((val) => {
      const qty = Number(val.quantity) || 0;
      const sRate = Number(val.sellerBrokerageRate) || 0;
      const bRate = Number(val.buyerBrokerageRate) || 0;

      this.sellerBrokerageAmount.set(qty * sRate);
      this.buyerBrokerageAmount.set(qty * bRate);
    });

    this.dealForm.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      this.saveDeal();
    } else if (event.key === 'Escape') {
      this.resetForm();
    }
  }

  filteredSellers = computed(() => {
    const term = this.sellerSearch().toLowerCase();
    return this.parties().filter(
      (p) =>
        (p.role === 'SELLER' || p.role === 'BOTH') &&
        (p.firmName.toLowerCase().includes(term) ||
          p.city.toLowerCase().includes(term) || p.mobile.includes(term)),
    );
  });

  filteredBuyers = computed(() => {
    const term = this.buyerSearch().toLowerCase();
    return this.parties().filter(
      (p) =>
        (p.role === 'BUYER' || p.role === 'BOTH') &&
        (p.firmName.toLowerCase().includes(term) ||
          p.city.toLowerCase().includes(term) || p.mobile.includes(term)),
    );
  });

  selectSeller(party: Party): void {
    this.selectedSeller.set(party);
    this.dealForm.patchValue({ sellerId: party.id });
    this.sellerSearch.set(party.firmName);
    this.sellerDropdownOpen.set(false);
  }

  selectBuyer(party: Party): void {
    this.selectedBuyer.set(party);
    this.dealForm.patchValue({ buyerId: party.id });
    this.buyerSearch.set(party.firmName);
    this.buyerDropdownOpen.set(false);
  }

  exportPdf(): void {
    if (this.dealForm.invalid || !this.selectedSeller() || !this.selectedBuyer()) {
      alert('Please select valid seller and buyer before exporting PDF.');
      return;
    }

    this.pdfExportService.downloadDualBrokeragePdf(this.buildDealPayload());
  }

  saveDeal(): void {
    if (this.dealForm.invalid || !this.selectedSeller() || !this.selectedBuyer()) {
      alert('Please fill all mandatory fields and select valid parties.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const formVal = this.dealForm.getRawValue();
    const payload = this.buildDealPayload();
    const request: SaveDealBackendRequest = {
      dealNo: String(formVal.dealNo),
      dealDate: String(formVal.dealDate),
      item: String(formVal.itemQuality),
      quantity: Number(formVal.quantity),
      unit: String(formVal.unit),
      rate: Number(formVal.dealRate),
      truckNo: String(Number(formVal.motor) || 0),
      remarks: String(formVal.remarks || ''),
      seller: { id: this.selectedSeller()!.id, rate: Number(formVal.sellerBrokerageRate) },
      buyer: { id: this.selectedBuyer()!.id, rate: Number(formVal.buyerBrokerageRate) },
    };

    const sellerTab = formVal.autoOpenWhatsApp ? window.open('about:blank', '_blank') : null;
    const buyerTab = formVal.autoOpenWhatsApp ? window.open('about:blank', '_blank') : null;
    this.dealApi.saveDeal(request).subscribe({
      next: () => {
        try {
          if (formVal.autoOpenWhatsApp) {
            const sellerUrl = this.waService.generateSellerUrl(payload);
            const buyerUrl = this.waService.generateBuyerUrl(payload);
            if (sellerTab) sellerTab.location.href = sellerUrl;
            if (buyerTab) buyerTab.location.href = buyerUrl;
          }
          if (formVal.autoGeneratePdf) this.pdfExportService.downloadDualBrokeragePdf(payload);
          this.successMessage.set(`Sauda #${formVal.dealNo} saved. Dual brokerage bills were created.`);
          const currentNo = Number(this.nextDealNumber() || '5001');
          const incrementedNo = String(currentNo + 1).padStart(4, '0');
          this.nextDealNumber.set(incrementedNo);
          this.dealForm.patchValue({ dealNo: incrementedNo }, { emitEvent: false });
          this.resetForm();
        } catch {
          this.errorMessage.set('The deal was saved, but a PDF or WhatsApp action could not be opened.');
        } finally {
          this.isSubmitting.set(false);
        }
      },
      error: (error: unknown) => {
        sellerTab?.close();
        buyerTab?.close();

        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.loadNextDealNumber();
          this.errorMessage.set('This sauda number already exists. The next available number has been loaded. Please retry.');
          this.isSubmitting.set(false);
          return;
        }

        this.errorMessage.set(error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
          ? error.error.error
          : 'Could not save the deal. Check the backend API connection.');
        this.isSubmitting.set(false);
      },
    });
  }

  private buildDealPayload(): DealPayload {
    const formVal = this.dealForm.getRawValue();
    const seller = this.selectedSeller()!;
    const buyer = this.selectedBuyer()!;

    return {
      dealNo: formVal.dealNo,
      dealDate: formVal.dealDate,
      item: formVal.itemQuality,
      quantity: formVal.quantity,
      unit: formVal.unit,
      rate: formVal.dealRate,
      truckNo: String(Number(formVal.motor) || 0),
      seller: {
        id: seller.id,
        name: seller.firmName,
        phone: seller.mobile,
        rate: formVal.sellerBrokerageRate,
        amount: this.sellerBrokerageAmount(),
      },
      buyer: {
        id: buyer.id,
        name: buyer.firmName,
        phone: buyer.mobile,
        rate: formVal.buyerBrokerageRate,
        amount: this.buyerBrokerageAmount(),
      },
    };
  }

  resetForm(): void {
    const nextNumber = this.nextDealNumber();
    this.dealForm.reset({
      dealNo: nextNumber,
      dealDate: new Date().toISOString().substring(0, 10),
      unit: 'TON',
      motor: 0,
      autoOpenWhatsApp: true,
      autoGeneratePdf: true,
    });
    this.selectedSeller.set(null);
    this.selectedBuyer.set(null);
    this.sellerSearch.set('');
    this.buyerSearch.set('');
  }
}
