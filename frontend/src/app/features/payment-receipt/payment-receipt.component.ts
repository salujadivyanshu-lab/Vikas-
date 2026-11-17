import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, HostListener, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackendParty, DealApiService, PaymentMode, SaveReceiptRequest } from '../../core/services/deal-api.service';

export interface PartyMaster {
  id: number;
  firmName: string;
  contactPerson: string;
  mobile: string;
  city: string;
  currentDue: number;
}

interface ReceiptFormValue {
  receiptNo: string;
  receiptDate: string;
  partyId: number | null;
  paymentMode: PaymentMode;
  receivedAmount: number;
  discountAmount: number;
  referenceNo: string;
  remarks: string;
  autoSendWhatsApp: boolean;
}

@Component({
  selector: 'app-payment-receipt',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './payment-receipt.component.html',
  styleUrls: ['./payment-receipt.component.scss', '../../api-feedback.scss'],
})
export class PaymentReceiptComponent implements OnInit {
  receiptForm!: FormGroup;
  parties = signal<PartyMaster[]>([]);
  isLoadingParties = signal(false);
  isSaving = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  partySearch = signal('');
  partyDropdownOpen = signal(false);
  selectedParty = signal<PartyMaster | null>(null);
  payableAmount = signal(0);
  receivedAmount = signal(0);
  discountAmount = signal(0);
  remainingBalance = computed(() => Math.max(0, this.payableAmount() - this.receivedAmount() - this.discountAmount()));
  filteredParties = computed(() => {
    const term = this.partySearch().toLowerCase().trim();
    if (!term) return this.parties();
    return this.parties().filter((party) =>
      [party.firmName, party.contactPerson, party.city, party.mobile].some((value) => value.toLowerCase().includes(term)),
    );
  });

  constructor(
    private fb: FormBuilder,
    private destroyRef: DestroyRef,
    private dealApi: DealApiService,
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.receiptForm = this.fb.group({
      receiptNo: ['RCP-842', Validators.required],
      receiptDate: [today, Validators.required],
      partyId: [null, Validators.required],
      paymentMode: ['UPI', Validators.required],
      receivedAmount: [0, [Validators.required, Validators.min(1)]],
      discountAmount: [0, Validators.min(0)],
      referenceNo: [''],
      remarks: [''],
      autoSendWhatsApp: [true],
    });

    this.receiptForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.receivedAmount.set(Number(value.receivedAmount) || 0);
      this.discountAmount.set(Number(value.discountAmount) || 0);
    });

    this.loadParties();
  }

  loadParties(): void {
    this.isLoadingParties.set(true);
    this.errorMessage.set('');
    this.dealApi.getParties().subscribe({
      next: (records: BackendParty[]) => {
        this.parties.set(records.map((party) => ({
          id: Number(party.id),
          firmName: party.firmName,
          contactPerson: party.contactPerson || '',
          mobile: party.mobile,
          city: party.city || '',
          currentDue: Number(party.currentDue) || 0,
        })).filter((party) => party.currentDue > 0));
        this.isLoadingParties.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load parties. Check that the backend API is running.');
        this.isLoadingParties.set(false);
      },
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      this.saveReceipt();
    } else if (event.key === 'Escape') {
      this.resetForm();
    }
  }

  updatePartySearch(value: string): void {
    this.partySearch.set(value);
    this.partyDropdownOpen.set(true);
    this.selectedParty.set(null);
    this.payableAmount.set(0);
    this.receiptForm.patchValue({ partyId: null });
  }

  selectParty(party: PartyMaster): void {
    this.selectedParty.set(party);
    this.payableAmount.set(party.currentDue);
    this.receiptForm.patchValue({ partyId: party.id, receivedAmount: party.currentDue });
    this.partySearch.set(party.firmName);
    this.partyDropdownOpen.set(false);
  }

  saveReceipt(): void {
    if (this.receiptForm.invalid || !this.selectedParty()) {
      this.receiptForm.markAllAsTouched();
      return;
    }

    const value = this.receiptForm.getRawValue() as ReceiptFormValue;
    const party = this.selectedParty()!;
    const amount = Number(value.receivedAmount);
    const discount = Number(value.discountAmount) || 0;
    if (amount + discount > party.currentDue + 0.005) {
      this.errorMessage.set('Payment and discount cannot exceed the party current due.');
      return;
    }

    const payload: SaveReceiptRequest = {
      receiptNo: String(value.receiptNo),
      partyId: party.id,
      paymentDate: String(value.receiptDate),
      amount,
      discount,
      paymentMode: value.paymentMode,
      referenceNo: value.referenceNo,
      remarks: value.remarks,
    };
    const whatsAppTab = value.autoSendWhatsApp ? window.open('about:blank', '_blank') : null;
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.dealApi.createReceipt(payload).subscribe({
      next: (receipt) => {
        const updatedDue = Number(receipt.currentDue) || 0;
        const updatedParty = { ...party, currentDue: updatedDue };
        this.parties.update((list) => list.map((item) => item.id === party.id ? updatedParty : item));
        if (value.autoSendWhatsApp) {
          const receiptUrl = this.buildWhatsAppReceiptUrl(updatedParty, value, updatedDue);
          if (whatsAppTab) whatsAppTab.location.href = receiptUrl;
        }
        this.successMessage.set(`Receipt ${receipt.receiptNo} recorded. Remaining due: ₹${updatedDue.toLocaleString('en-IN')}.`);
        this.isSaving.set(false);
        this.resetForm();
      },
      error: (error: unknown) => {
        whatsAppTab?.close();
        this.errorMessage.set(error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
          ? error.error.error
          : 'Could not record the receipt. Check the backend API connection.');
        this.isSaving.set(false);
      },
    });
  }

  private buildWhatsAppReceiptUrl(party: PartyMaster, value: ReceiptFormValue, remaining: number): string {
    const cleanPhone = party.mobile.replace(/\D/g, '');
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const discountLine = value.discountAmount > 0
      ? `* Discount/Kasar:* ₹${Number(value.discountAmount).toLocaleString('en-IN')}\n`
      : '';
    const reference = value.referenceNo ? ` (${value.referenceNo})` : '';
    const message = `*PAYMENT RECEIPT - VIKAS BROKER*\n------------------------------------\nNamaskar *${party.firmName}*,\nWe have received your payment with thanks:\n\n* Receipt No:* #${value.receiptNo}\n* Date:* ${value.receiptDate}\n* Mode:* ${value.paymentMode}${reference}\n* Amount Received:* *₹${Number(value.receivedAmount).toLocaleString('en-IN')}*\n${discountLine}------------------------------------\n* Remaining Dues:* *₹${remaining.toLocaleString('en-IN')}*\n\nThank you for your timely settlement!`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  resetForm(): void {
    this.errorMessage.set('');
    this.receiptForm.reset({
      receiptNo: `RCP-${Math.floor(Math.random() * 900) + 100}`,
      receiptDate: new Date().toISOString().substring(0, 10),
      paymentMode: 'UPI',
      receivedAmount: 0,
      discountAmount: 0,
      autoSendWhatsApp: true,
    });
    this.selectedParty.set(null);
    this.payableAmount.set(0);
    this.partySearch.set('');
    this.partyDropdownOpen.set(false);
  }
}