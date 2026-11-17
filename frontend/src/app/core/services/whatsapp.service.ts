import { Injectable } from '@angular/core';

export interface DealParticipant {
  id: number;
  name: string;
  phone: string;
  rate: number;
  amount: number;
}

export interface DealPayload {
  dealNo: string;
  dealDate: string;
  item: string;
  quantity: number;
  unit: string;
  rate: number;
  truckNo?: string;
  seller: DealParticipant;
  buyer: DealParticipant;
}

export interface WhatsAppPayload {
  name?: string;
  phone?: string;
  project?: string;
  amount?: string | number;
  remarks?: string;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class WhatsAppBrokerService {
  public generateSellerUrl(payload: DealPayload): string {
    const sellerPhone = payload.seller.phone.replace(/\D/g, '');
    const message = [
      `Dealing *#${payload.dealNo}*`,
      `Date: ${payload.dealDate}`,
      `Item: ${payload.item}`,
      `Qty: ${payload.quantity} ${payload.unit}`,
      `Rate: ${this.formatMoney(payload.rate)}`,
      `Motor: ${payload.truckNo || '-'}`,
      `Seller: ${payload.seller.name}`,
      //`Seller brokerage: ${this.formatMoney(payload.seller.amount)} @ ${payload.seller.rate}/unit`,
      `Buyer: ${payload.buyer.name}`,
      //`Buyer brokerage: ${this.formatMoney(payload.buyer.amount)} @ ${payload.buyer.rate}/unit`,
    ].join('\n');

    return `https://wa.me/${sellerPhone}?text=${encodeURIComponent(message)}`;
  }

  public generateBuyerUrl(payload: DealPayload): string {
    const buyerPhone = payload.buyer.phone.replace(/\D/g, '');
    const message = [
      `Dealing *#${payload.dealNo}*`,
      `Date: ${payload.dealDate}`,
      `Item: ${payload.item}`,
      `Qty: ${payload.quantity} ${payload.unit}`,
      `Rate: ${this.formatMoney(payload.rate)}`,
      `Motor: ${payload.truckNo || '-'}`,
      `Seller: ${payload.seller.name}`,
      `Buyer: ${payload.buyer.name}`,
      `Buyer brokerage: ${this.formatMoney(payload.buyer.amount)} @ ${payload.buyer.rate}/unit`,
    ].join('\n');

    return `https://wa.me/${buyerPhone}?text=${encodeURIComponent(message)}`;
  }

  public generateDueReminderUrl(payload: {
    name: string;
    phone: string;
    due: number;
    unsettledDeals: number;
  }): string {
    const cleanedPhone = payload.phone.replace(/\D/g, '');
    const mobile = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone;
    const message = [
      `Dear *${payload.name}*,`,
      '',
      'This is a reminder for unpaid dues.',
      `Net due outstanding: *₹${payload.due.toLocaleString('en-IN')}*`,
      `Unsettled deals: *${payload.unsettledDeals}*`,
      '',
      'Please update the payment status at the earliest.',
    ].join('\n');

    return `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`;
  }

  public buildWhatsAppUrl(
    payload: WhatsAppPayload,
    phoneNumber?: string,
    intro = 'Hello',
  ): string {
    const mobile = (phoneNumber ?? payload.phone ?? '').toString().replace(/\D/g, '');
    const message = this.buildMessage(payload, intro);
    const baseUrl = mobile ? `https://wa.me/${mobile}` : 'https://wa.me';

    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }

  public buildMessage(payload: WhatsAppPayload, intro = 'Hello'): string {
    const lines = [
      intro,
      payload.name ? `Name: ${payload.name}` : '',
      payload.project ? `Project: ${payload.project}` : '',
      payload.amount ? `Amount: ${payload.amount}` : '',
      payload.remarks ? `Remarks: ${payload.remarks}` : '',
    ].filter(Boolean);

    return lines.join('\n');
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }
}

export class WhatsappService extends WhatsAppBrokerService {}
