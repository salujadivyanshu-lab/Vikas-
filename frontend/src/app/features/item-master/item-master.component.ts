import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BackendItem, DealApiService } from '../../core/services/deal-api.service';

interface ItemRecord {
  id: number;
  name: string;
  defaultUnit: string;
}

@Component({
  selector: 'app-item-master',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './item-master.component.html',
  styleUrl: './item-master.component.scss',
})
export class ItemMasterComponent implements OnInit {
  itemForm!: FormGroup;
  items = signal<ItemRecord[]>([]);
  searchTerm = signal('');
  isLoading = signal(false);
  isSaving = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.items().filter((item) => !term || item.name.toLowerCase().includes(term) || item.defaultUnit.toLowerCase().includes(term));
  });

  constructor(private fb: FormBuilder, private api: DealApiService) {}

  ngOnInit(): void {
    this.itemForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      defaultUnit: ['TON', [Validators.required, Validators.maxLength(20)]],
    });
    this.loadItems();
  }

  loadItems(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.api.getItems().subscribe({
      next: (items) => {
        this.items.set(items.map((item) => this.mapItem(item)));
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load items. Check the backend API connection.');
        this.isLoading.set(false);
      },
    });
  }

  saveItem(): void {
    if (this.itemForm.invalid || this.isSaving()) {
      this.itemForm.markAllAsTouched();
      return;
    }
    const value = this.itemForm.getRawValue();
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.api.createItem({ name: String(value.name).trim(), defaultUnit: String(value.defaultUnit).trim().toUpperCase() }).subscribe({
      next: (item) => {
        this.items.update((items) => [this.mapItem(item), ...items]);
        this.itemForm.reset({ name: '', defaultUnit: 'TON' });
        this.successMessage.set(`${item.name} added to Item Master.`);
        this.isSaving.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
          ? error.error.error
          : 'Could not save this item.');
        this.isSaving.set(false);
      },
    });
  }

  private mapItem(item: BackendItem): ItemRecord {
    return { id: Number(item.id), name: item.name, defaultUnit: item.defaultUnit };
  }
}
