import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { WhatsAppBrokerService } from '../../core/services/whatsapp.service';
import { BackendPartyDue, DealApiService } from '../../core/services/deal-api.service';

export interface PartyDueItem {
  id: number;
  firmName: string;
  contactPerson: string;
  mobile: string;
  city: string;
  role: 'SELLER' | 'BUYER' | 'BOTH';
  totalDeals: number;
  totalBilled: number;
  totalReceived: number;
  netDue: number;
  oldestUnpaidDays: number;
  lastPaymentDate?: string;
  pendingGoodsValue?: number;
}

type AgingFilter = 'ALL' | '0-15' | '16-30' | '31-60' | '60+';
interface FinancialYearOption {
  value: string;
  label: string;
  from: string;
  to: string;
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  styleUrl: './dashboard-date-filter.scss',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private readonly currentFinancialYearStart = (() => {
    const today = new Date();
    return today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  })();
  readonly financialYears: FinancialYearOption[] = [
    ...Array.from({ length: 6 }, (_, index) => {
      const startYear = this.currentFinancialYearStart - index;
      const endYear = startYear + 1;
      return {
        value: String(startYear),
        label: `FY ${startYear}-${String(endYear).slice(-2)}`,
        from: `${startYear}-04-01`,
        to: `${endYear}-03-31`,
      };
    }),
    { value: 'ALL', label: 'All financial years', from: '', to: '' },
  ];
  selectedFinancialYear = signal(String(this.currentFinancialYearStart));
  duesList = signal<PartyDueItem[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  searchTerm = signal<string>('');
  selectedAgingBucket = signal<AgingFilter>('ALL');
  roleFilter = signal<'ALL' | 'SELLER' | 'BUYER'>('ALL');

  activePartyCount = computed(() => this.duesList().filter((party) => party.netDue > 0).length);
  selectedFinancialYearLabel = computed(() =>
    this.financialYears.find((year) => year.value === this.selectedFinancialYear())?.label || 'All financial years',
  );
  periodBilled = computed(() => this.duesList().reduce((sum, party) => sum + party.totalBilled, 0));
  periodReceived = computed(() => this.duesList().reduce((sum, party) => sum + party.totalReceived, 0));

  totalReceivable = computed(() =>
    this.duesList().reduce((acc, curr) => acc + Math.max(0, curr.netDue), 0),
  );

  sellerDues = computed(() =>
    this.duesList()
      .filter((p) => p.role === 'SELLER' || p.role === 'BOTH')
      .reduce((acc, curr) => acc + Math.max(0, curr.netDue), 0),
  );

  buyerDues = computed(() =>
    this.duesList()
      .filter((p) => p.role === 'BUYER' || p.role === 'BOTH')
      .reduce((acc, curr) => acc + Math.max(0, curr.netDue), 0),
  );

  criticalOverdueCount = computed(() =>
    this.duesList().filter((p) => p.netDue > 0 && p.oldestUnpaidDays > 30).length,
  );

  filteredDues = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const bucket = this.selectedAgingBucket();
    const role = this.roleFilter();

    return this.duesList().filter((item) => {
      if (item.netDue <= 0) return false;
      const matchesSearch =
        !term ||
        item.firmName.toLowerCase().includes(term) ||
        item.contactPerson.toLowerCase().includes(term) ||
        item.city.toLowerCase().includes(term) ||
        item.mobile.includes(term);

      const matchesRole =
        role === 'ALL' || item.role === role || item.role === 'BOTH';

      let matchesBucket = true;
      if (bucket === '0-15') {
        matchesBucket = item.oldestUnpaidDays <= 15;
      } else if (bucket === '16-30') {
        matchesBucket = item.oldestUnpaidDays >= 16 && item.oldestUnpaidDays <= 30;
      } else if (bucket === '31-60') {
        matchesBucket = item.oldestUnpaidDays >= 31 && item.oldestUnpaidDays <= 60;
      } else if (bucket === '60+') {
        matchesBucket = item.oldestUnpaidDays > 60;
      }

      return matchesSearch && matchesRole && matchesBucket;
    });
  });

  constructor(
    private waService: WhatsAppBrokerService,
    private dealApi: DealApiService,
  ) {}

  ngOnInit(): void {
    this.loadDues();
  }

  loadDues(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    const year = this.financialYears.find((option) => option.value === this.selectedFinancialYear());
    this.dealApi.getDashboardDues(year?.from, year?.to).subscribe({
      next: (records: BackendPartyDue[]) => {
        this.duesList.set(records.map((party) => ({
          ...party,
          id: Number(party.id),
          totalDeals: Number(party.totalDeals) || 0,
          totalBilled: Number(party.totalBilled) || 0,
          totalReceived: Number(party.totalReceived) || 0,
          netDue: Number(party.netDue) || 0,
          oldestUnpaidDays: Number(party.oldestUnpaidDays) || 0,
          lastPaymentDate: party.lastPaymentDate || undefined,
          pendingGoodsValue: Number(party.pendingGoodsValue) || 0,
        })));
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load dashboard balances. Check the backend API connection.');
        this.isLoading.set(false);
      },
    });
  }

  setAgingBucket(bucket: AgingFilter): void {
    this.selectedAgingBucket.set(bucket);
  }

  sendWhatsAppReminder(party: PartyDueItem): void {
    const url = this.waService.generateDueReminderUrl({
      name: party.firmName,
      phone: party.mobile,
      due: party.netDue,
      unsettledDeals: party.totalDeals,
    });
    window.open(url, '_blank');
  }

  sendGoodsPaymentReminder(party: PartyDueItem): void {
    if (!party.pendingGoodsValue) return;

    const cleanedPhone = party.mobile.replace(/\D/g, '');
    const formattedPhone = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone;

    const msg = `*GOODS PAYMENT STATUS - VIKAS BROKER*\n------------------------------------\nDear *${party.firmName}*,\n\nRegarding trade commodity settlements, pending balance of goods value is:\n* Outstanding Goods Value:* *₹${party.pendingGoodsValue.toLocaleString('en-IN')}*\n\nKindly update the payment status once transferred to the seller mill.`;

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }
}
