import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackendParty, DealApiService, SavePartyRequest } from '../../core/services/deal-api.service';

export type PartyRole = 'SELLER' | 'BUYER' | 'BOTH';
export type BalanceType = 'RECEIVABLE' | 'PAYABLE';

export interface PartyRecord {
  id: number;
  firmName: string;
  contactPerson: string;
  mobile: string;
  phone?: string;
  email?: string;
  city: string;
  address?: string;
  role: PartyRole;
  openingBalance: number;
  balanceType: BalanceType;
  currentDue: number;
  createdAt: string;
}

@Component({
  selector: 'app-party-master',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './party-master.component.html',
})
export class PartyMasterComponent implements OnInit {
  partyForm!: FormGroup;
  parties = signal<PartyRecord[]>([]);
  asOfDate = signal(new Date().toISOString().slice(0, 10));

  isEditing = signal(false);
  activePartyId = signal<number | null>(null);
  searchFilter = signal('');
  cityFilter = signal('ALL');
  selectedRoleTab = signal<'ALL' | PartyRole>('ALL');
  isLoading = signal(false);
  isSaving = signal(false);
  isDeleting = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  pendingDelete = signal<PartyRecord | null>(null);
  cities = computed(() => [...new Set(this.parties().map((party) => party.city).filter(Boolean))].sort());
  roleCounts = computed(() => ({
    ALL: this.parties().length,
    SELLER: this.parties().filter((party) => party.role === 'SELLER').length,
    BUYER: this.parties().filter((party) => party.role === 'BUYER').length,
    BOTH: this.parties().filter((party) => party.role === 'BOTH').length,
  }));
  filteredParties = computed(() => {
    const term = this.searchFilter().toLowerCase().trim();
    const role = this.selectedRoleTab();
    const city = this.cityFilter();
    return this.parties().filter((party) => {
      const values = [party.firmName, party.contactPerson, party.city, party.mobile, party.phone, party.email, party.address];
      const matchesSearch = !term || values.some((value) => String(value || '').toLowerCase().includes(term));
      return matchesSearch && (role === 'ALL' || party.role === role) && (city === 'ALL' || party.city === city);
    });
  });

  constructor(private fb: FormBuilder, private dealApi: DealApiService) {}

  ngOnInit(): void {
    this.partyForm = this.fb.group({
      firmName: ['', [Validators.required, Validators.minLength(2)]],
      contactPerson: ['', Validators.required],
      mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      phone: [''],
      email: ['', Validators.email],
      city: ['', Validators.required],
      address: [''],
      role: ['BOTH', Validators.required],
      openingBalance: [0, [Validators.required, Validators.min(0)]],
      balanceType: ['RECEIVABLE', Validators.required],
    });
    this.loadParties();
  }

  loadParties(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.dealApi.getParties(this.asOfDate()).subscribe({
      next: (records) => {
        this.parties.set(records.map((party) => this.fromBackendParty(party)));
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.apiErrorMessage(error, 'Could not load parties. Check that the backend API is running.'));
        this.isLoading.set(false);
      },
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      this.saveParty();
    } else if (event.key === 'Escape') {
      if (this.pendingDelete()) {
        this.cancelDelete();
        return;
      }
      this.resetForm();
    }
  }

  startNewParty(): void {
    this.isEditing.set(false);
    this.activePartyId.set(null);
    this.partyForm.reset({ role: 'BOTH', openingBalance: 0, balanceType: 'RECEIVABLE' });
  }

  editParty(party: PartyRecord): void {
    this.isEditing.set(true);
    this.activePartyId.set(party.id);
    this.partyForm.patchValue(party);
  }

  saveParty(): void {
    if (this.partyForm.invalid) {
      this.partyForm.markAllAsTouched();
      return;
    }
    const formValue = this.partyForm.getRawValue();
    const payload: SavePartyRequest = {
      ...formValue,
      firmName: String(formValue.firmName).trim(),
      contactPerson: String(formValue.contactPerson).trim(),
      mobile: String(formValue.mobile).trim(),
      phone: String(formValue.phone || '').trim(),
      email: String(formValue.email || '').trim(),
      city: String(formValue.city).trim(),
      address: String(formValue.address || '').trim(),
      role: formValue.role as PartyRole,
      openingBalance: Number(formValue.openingBalance),
      balanceType: formValue.balanceType as BalanceType,
    };
    const editingId = this.activePartyId();
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const request = editingId === null
      ? this.dealApi.createParty(payload)
      : this.dealApi.updateParty(editingId, payload);
    request.subscribe({
      next: (savedParty) => {
        const record = this.fromBackendParty(savedParty);
        this.parties.update((list) => editingId === null
          ? [record, ...list]
          : list.map((party) => party.id === editingId ? record : party));
        this.successMessage.set(editingId === null ? 'Party added to the master directory.' : 'Party details updated.');
        this.isSaving.set(false);
        this.startNewParty();
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.apiErrorMessage(error, 'Could not save this party.'));
        this.isSaving.set(false);
      },
    });
  }

  deleteParty(party: PartyRecord, event: MouseEvent): void {
    event.stopPropagation();
    this.pendingDelete.set(party);
    this.errorMessage.set('');
  }

  confirmDelete(): void {
    const party = this.pendingDelete();
    if (!party || party.currentDue > 0) return;

    this.isDeleting.set(true);
    this.errorMessage.set('');
    this.dealApi.deleteParty(party.id).subscribe({
      next: () => {
        this.parties.update((list) => list.filter((item) => item.id !== party.id));
        if (this.activePartyId() === party.id) this.startNewParty();
        this.pendingDelete.set(null);
        this.isDeleting.set(false);
        this.successMessage.set('Party deleted.');
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.apiErrorMessage(error, 'Could not delete this party.'));
        this.isDeleting.set(false);
      },
    });
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
    this.isDeleting.set(false);
  }

  private fromBackendParty(party: BackendParty): PartyRecord {
    return {
      ...party,
      id: Number(party.id),
      openingBalance: Number(party.openingBalance) || 0,
      currentDue: Number(party.currentDue) || 0,
    };
  }

  private apiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return fallback;
  }

  openWhatsAppDirect(party: PartyRecord, event: MouseEvent): void {
    event.stopPropagation();
    const clean = party.mobile.replace(/\D/g, '');
    const phone = clean.length === 10 ? `91${clean}` : clean;
    const message = `Namaskar ${party.firmName}, regarding your account with Vikas Brokerage:`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  resetForm(): void {
    this.startNewParty();
  }
}