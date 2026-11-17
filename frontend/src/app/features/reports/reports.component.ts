import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { BackendParty, DealApiService, DealReportRow, ReceiptReportRow } from '../../core/services/deal-api.service';
import { PdfExportService } from '../../core/services/pdf-export.service';

type ReportType = 'DEALS' | 'RECEIPTS' | 'INVOICES';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private readonly pdfExportService = inject(PdfExportService);
  private readonly today = new Date().toISOString().slice(0, 10);
  fromDate = signal(this.today.slice(0, 8) + '01');
  toDate = signal(this.today);
  activeReport = signal<ReportType>('DEALS');
  dealRows = signal<DealReportRow[]>([]);
  receiptRows = signal<ReceiptReportRow[]>([]);
  partyOptions = signal<BackendParty[]>([]);
  buyerFilter = signal<number | 'ALL'>('ALL');
  sellerFilter = signal<number | 'ALL'>('ALL');
  isLoading = signal(false);
  errorMessage = signal('');

  totalGoods = computed(() => this.dealRows().reduce((sum, row) => sum + Number(row.goodsAmount || 0), 0));
  totalBrokerage = computed(() => this.dealRows().reduce((sum, row) => sum + Number(row.sellerBrokerage || 0) + Number(row.buyerBrokerage || 0), 0));
  totalReceipts = computed(() => this.receiptRows().reduce((sum, row) => sum + Number(row.amount || 0), 0));
  totalDiscount = computed(() => this.receiptRows().reduce((sum, row) => sum + Number(row.discount || 0), 0));
  activeCount = computed(() => this.activeReport() === 'RECEIPTS' ? this.receiptRows().length : this.dealRows().length);

  brokerageFor(row: DealReportRow): number {
    return Number(row.sellerBrokerage) + Number(row.buyerBrokerage);
  }

  onSellerFilterChange(value: string): void {
    this.sellerFilter.set(value === 'ALL' ? 'ALL' : Number(value));
    this.loadReports();
  }

  onBuyerFilterChange(value: string): void {
    this.buyerFilter.set(value === 'ALL' ? 'ALL' : Number(value));
    this.loadReports();
  }

  constructor(private api: DealApiService) {}

  ngOnInit(): void {
    this.loadParties();
    this.loadReports();
  }

  loadParties(): void {
    this.api.getParties().subscribe({
      next: (parties) => {
        this.partyOptions.set(parties);
      },
      error: () => {
        this.partyOptions.set([]);
      },
    });
  }

  loadReports(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    const sellerId = this.sellerFilter() === 'ALL' ? 'ALL' : Number(this.sellerFilter());
    const buyerId = this.buyerFilter() === 'ALL' ? 'ALL' : Number(this.buyerFilter());
    forkJoin({
      deals: this.api.getDealReport(this.fromDate(), this.toDate(), sellerId, buyerId),
      receipts: this.api.getReceiptReport(this.fromDate(), this.toDate(), sellerId, buyerId),
    }).subscribe({
      next: ({ deals, receipts }) => {
        this.dealRows.set(deals);
        this.receiptRows.set(receipts);
        this.isLoading.set(false);
      },
      error: (error: { error?: { error?: string } }) => {
        this.errorMessage.set(error.error?.error || 'Could not load reports from the backend.');
        this.isLoading.set(false);
      },
    });
  }

  downloadInvoice(row: DealReportRow): void {
    this.pdfExportService.downloadLedgerInvoice({
      dealNo: String(row.dealNo),
      dealDate: String(row.dealDate),
      sellerName: String(row.sellerName || 'Seller'),
      buyerName: String(row.buyerName || 'Buyer'),
      motor: Number(row.motor || 0),
      itemName: String(row.itemName || 'Commodity'),
      quantity: Number(row.quantity || 0),
      unit: String(row.unit || 'TON'),
      amount: Number(row.goodsAmount || 0),
      brokerage: Number(row.sellerBrokerage || 0) + Number(row.buyerBrokerage || 0),
    });
  }

  downloadPartyLedger(): void {
    const role = this.sellerFilter() !== 'ALL' ? 'SELLER' : 'BUYER';
    const partyId = role === 'SELLER' ? this.sellerFilter() : this.buyerFilter();
    const party = this.partyOptions().find((item) => String(item.id) === String(partyId));
    if (!party) return;

    this.pdfExportService.downloadPartyLedger({
      party,
      role,
      fromDate: this.fromDate(),
      toDate: this.toDate(),
      rows: this.dealRows(),
    });
  }

  downloadCsv(): void {
    const rows: (string | number)[][] = this.activeReport() === 'DEALS' || this.activeReport() === 'INVOICES'
      ? [
          ['Sauda No', 'Date', 'Seller', 'Buyer', 'Item', 'Quantity', 'Unit', 'Rate', 'Goods Value', 'Seller Brokerage', 'Buyer Brokerage'],
          ...this.dealRows().map((row) => [row.dealNo, row.dealDate, row.sellerName, row.buyerName, row.itemName,
            Number(row.quantity), row.unit, Number(row.rate), Number(row.goodsAmount), Number(row.sellerBrokerage), Number(row.buyerBrokerage)]),
        ]
      : [
          ['Receipt No', 'Date', 'Party', 'Payment Mode', 'Reference', 'Amount', 'Discount', 'Remarks'],
          ...this.receiptRows().map((row) => [row.receiptNo, row.paymentDate, row.firmName, row.paymentMode,
            row.referenceNo || '', Number(row.amount), Number(row.discount), row.remarks || '']),
        ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.activeReport() === 'RECEIPTS' ? 'payment-receipts' : this.activeReport() === 'INVOICES' ? 'invoice-ledger' : 'sauda-register'}-${this.fromDate()}-to-${this.toDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
