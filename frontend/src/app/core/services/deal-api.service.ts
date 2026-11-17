import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BackendParty {
  id: number | string;
  firmName: string;
  contactPerson: string;
  mobile: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  role: 'SELLER' | 'BUYER' | 'BOTH';
  openingBalance: number | string;
  balanceType: 'RECEIVABLE' | 'PAYABLE';
  currentDue: number | string;
  createdAt: string;
}

export interface SavePartyRequest {
  firmName: string;
  contactPerson: string;
  mobile: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  role: 'SELLER' | 'BUYER' | 'BOTH';
  openingBalance: number;
  balanceType: 'RECEIVABLE' | 'PAYABLE';
}

export interface SaveDealBackendRequest {
  dealNo: string;
  dealDate: string;
  item: string;
  unit: string;
  quantity: number;
  rate: number;
  truckNo?: string;
  remarks?: string;
  seller: {
    id: number;
    rate: number;
  };
  buyer: {
    id: number;
    rate: number;
  };
}

export interface SaveDealResponse {
  success: boolean;
  dealId: number | string;
  message?: string;
}

export interface BackendPartyDue {
  id: number | string;
  firmName: string;
  contactPerson: string;
  mobile: string;
  city: string;
  role: 'SELLER' | 'BUYER' | 'BOTH';
  totalDeals: number | string;
  totalBilled: number | string;
  totalReceived: number | string;
  netDue: number | string;
  oldestUnpaidDays: number | string;
  lastPaymentDate?: string | null;
  pendingGoodsValue?: number | string | null;
}

export type PaymentMode = 'CASH' | 'NEFT_RTGS' | 'UPI' | 'CHEQUE';

export interface SaveReceiptRequest {
  receiptNo: string;
  partyId: number;
  paymentDate: string;
  amount: number;
  discount: number;
  paymentMode: PaymentMode;
  referenceNo: string;
  remarks: string;
}

export interface BackendReceipt extends Omit<SaveReceiptRequest, 'partyId'> {
  id: number | string;
  partyId: number | string;
  firmName: string;
  createdAt: string;
  currentDue?: number | string;
}

export interface BackendItem {
  id: number | string;
  name: string;
  defaultUnit: string;
}

export interface SaveItemRequest {
  name: string;
  defaultUnit: string;
}

export interface DealReportRow {
  id: number | string;
  dealNo: string;
  dealDate: string;
  sellerName: string;
  buyerName: string;
  motor: number | string;
  itemName: string;
  quantity: number | string;
  unit: string;
  rate: number | string;
  goodsAmount: number | string;
  sellerBrokerage: number | string;
  buyerBrokerage: number | string;
  sellerBrokerageRate: number | string;
  buyerBrokerageRate: number | string;
}

export interface ReceiptReportRow {
  id: number | string;
  receiptNo: string;
  paymentDate: string;
  firmName: string;
  amount: number | string;
  discount: number | string;
  paymentMode: PaymentMode;
  referenceNo: string | null;
  remarks: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DealApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getParties(asOfDate?: string): Observable<BackendParty[]> {
    const params = new URLSearchParams();
    if (asOfDate) params.set('asOfDate', asOfDate);
    const query = params.toString();
    return this.http.get<BackendParty[]>(`${this.baseUrl}/parties${query ? `?${query}` : ''}`);
  }

  getItems(): Observable<BackendItem[]> {
    return this.http.get<BackendItem[]>(`${this.baseUrl}/items`);
  }

  createItem(payload: SaveItemRequest): Observable<BackendItem> {
    return this.http.post<BackendItem>(`${this.baseUrl}/items`, payload);
  }

  createParty(payload: SavePartyRequest): Observable<BackendParty> {
    return this.http.post<BackendParty>(`${this.baseUrl}/parties`, payload);
  }

  updateParty(id: number, payload: SavePartyRequest): Observable<BackendParty> {
    return this.http.put<BackendParty>(`${this.baseUrl}/parties/${id}`, payload);
  }

  deleteParty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/parties/${id}`);
  }

  getDashboardDues(fromDate?: string, toDate?: string): Observable<BackendPartyDue[]> {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const query = params.toString();
    return this.http.get<BackendPartyDue[]>(`${this.baseUrl}/dashboard/dues${query ? `?${query}` : ''}`);
  }

  getNextDealNumber(): Observable<{ nextDealNo: string }> {
    return this.http.get<{ nextDealNo: string }>(`${this.baseUrl}/deals/next-number`);
  }

  saveDeal(payload: SaveDealBackendRequest): Observable<SaveDealResponse> {
    return this.http.post<SaveDealResponse>(`${this.baseUrl}/deals`, payload);
  }

  getReceipts(): Observable<BackendReceipt[]> {
    return this.http.get<BackendReceipt[]>(`${this.baseUrl}/receipts`);
  }

  createReceipt(payload: SaveReceiptRequest): Observable<BackendReceipt> {
    return this.http.post<BackendReceipt>(`${this.baseUrl}/receipts`, payload);
  }

  getDealReport(from: string, to: string, sellerId?: number | 'ALL', buyerId?: number | 'ALL'): Observable<DealReportRow[]> {
    return this.http.get<DealReportRow[]>(`${this.baseUrl}/reports/deals${this.dateQuery(from, to, sellerId, buyerId)}`);
  }

  getReceiptReport(from: string, to: string, sellerId?: number | 'ALL', buyerId?: number | 'ALL'): Observable<ReceiptReportRow[]> {
    return this.http.get<ReceiptReportRow[]>(`${this.baseUrl}/reports/receipts${this.dateQuery(from, to, sellerId, buyerId)}`);
  }

  private dateQuery(from: string, to: string, sellerId?: number | 'ALL', buyerId?: number | 'ALL'): string {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (sellerId && sellerId !== 'ALL') params.set('sellerId', String(sellerId));
    if (buyerId && buyerId !== 'ALL') params.set('buyerId', String(buyerId));
    const query = params.toString();
    return query ? `?${query}` : '';
  }
}
