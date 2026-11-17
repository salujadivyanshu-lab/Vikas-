import { Injectable } from '@angular/core';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { DealPayload } from './whatsapp.service';

type PdfMakeApi = {
  createPdf: (document: TDocumentDefinitions) => {
    download: (fileName: string) => void;
    open: () => void;
    getBlob: () => Promise<Blob>;
  };
  addVirtualFileSystem: (fonts: Record<string, string>) => void;
};

export interface BrokerFirmProfile {
  firmName: string;
  tagline: string;
  address: string;
  mobile: string;
  email: string;
  upiId: string;
  bankDetails: {
    bankName: string;
    accountNo: string;
    ifsc: string;
    accountHolder: string;
  };
}

export interface DealPdfData {
  customerName: string;
  phoneNumber: string;
  projectName: string;
  amount: number;
  status: string;
  notes: string;
}

@Injectable({
  providedIn: 'root',
})
export class PdfExportService {
  private pdfMakeApi: PdfMakeApi | null = null;
  private readonly vikasLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="118" viewBox="0 0 420 118">
    <circle cx="55" cy="53" r="47" fill="#f3f4f6" stroke="#263648" stroke-width="3"/>
    <circle cx="55" cy="53" r="41" fill="none" stroke="#9b7a45" stroke-width="2"/>
    <path d="M22 66 40 47 55 60 87 27" fill="none" stroke="#8a6838" stroke-width="7" stroke-linecap="square" stroke-linejoin="miter"/>
    <path d="m78 28 13-4-3 14" fill="none" stroke="#8a6838" stroke-width="6" stroke-linecap="square"/>
    <path d="M52 56c-3-18 2-31 12-39 1 13-2 26-12 39Zm3-2c5-15 14-22 26-23-5 12-13 20-26 23Z" fill="#315d49" stroke="#263648" stroke-width="1.5"/>
    <text x="115" y="53" font-family="Georgia,serif" font-size="38" font-weight="700" letter-spacing="2" fill="#263648">VIKAS</text>
    <text x="115" y="83" font-family="Georgia,serif" font-size="25" font-weight="700" letter-spacing="3" fill="#263648">BROKERS</text>
    <text x="117" y="105" font-family="Arial,sans-serif" font-size="15" fill="#315d49">Poha &amp; Murmura Specialized</text>
  </svg>`;

  private async getPdfMakeApi(): Promise<PdfMakeApi> {
    if (!this.pdfMakeApi) {
      const [pdfModule, fontModule] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
      ]);

      const api = (pdfModule as any).default ?? pdfModule;
      const pdfFonts = (fontModule as any).default ?? fontModule;
      api.addVirtualFileSystem(pdfFonts);
      this.pdfMakeApi = api as PdfMakeApi;
    }

    return this.pdfMakeApi;
  }

  private brokerProfile: BrokerFirmProfile = {
    firmName: 'Vikas Broker',
    tagline: 'Agricultural Commodities & Grain Brokers',
    address: 'Gulabbagh Mandi / City Centre, Gwalior (M.P.)',
    mobile: '+91 9135515989',
    email: 'vikasbrokers20@gmail.com',
    upiId: 'vikasbroker@upi',
    bankDetails: {
      bankName: 'HDFC Bank',
      accountNo: '502000XXXXXX',
      ifsc: 'HDFC0001234',
      accountHolder: 'Vikas Brokerage',
    },
  };

  public generateDealEntryPdf(data: DealPdfData): TDocumentDefinitions {
    const amount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(data.amount ?? 0);

    const noteLines = (data.notes || 'No additional notes provided.')
      .split('\n')
      .filter((line) => line.trim().length > 0);

    return {
      pageSize: 'A4',
      pageMargins: [32, 32, 32, 32],
      content: [
        {
          columns: [
            {
              stack: [
                { text: 'Vikas Broker', style: 'companyHeader' },
                { text: 'Broker Bill / Sauda Entry', style: 'title', margin: [0, 2, 0, 0] },
              ],
              width: '*',
            },
            {
              text: `Sauda No: #${data.customerName || '5021'}`,
              style: 'badge',
              alignment: 'right',
              width: 150,
            },
          ],
          columnGap: 12,
          margin: [0, 0, 0, 10],
        },
        {
          text: 'Non-GST Internal Trade Matching',
          style: 'subtitle',
          margin: [0, 0, 0, 10],
        },
        {
          columns: [
            {
              stack: [
                { text: 'Seller / Mill', style: 'sectionLabel' },
                { text: data.customerName, style: 'partyName' },
                { text: `Phone: ${data.phoneNumber}`, style: 'meta' },
                { text: `Project: ${data.projectName}`, style: 'meta' },
              ],
              width: '50%',
            },
            {
              stack: [
                { text: 'Buyer / Purchaser', style: 'sectionLabel' },
                { text: data.customerName, style: 'partyName' },
                { text: `Phone: ${data.phoneNumber}`, style: 'meta' },
                { text: `Status: ${data.status}`, style: 'meta' },
              ],
              width: '50%',
            },
          ],
          columnGap: 14,
          margin: [0, 0, 0, 12],
        },
        {
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: ['45%', '55%'],
            body: [
              [
                { text: 'Field', style: 'tableHeader' },
                { text: 'Value', style: 'tableHeader' },
              ],
              ['Item / Quality', data.projectName],
              ['Quantity', '25 TON'],
              ['Trade Rate', '₹ 2,550 / unit'],
              ['Total Goods Value', amount],
              ['Seller Brokerage', '₹ 3,000'],
              ['Buyer Brokerage', '₹ 2,500'],
              ['Net Brokerage Revenue', '₹ 5,500'],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 12],
        },
        {
          text: 'Transaction Notes',
          style: 'sectionTitle',
          margin: [0, 0, 0, 6],
        },
        {
          stack: noteLines.map((line) => ({ text: line, style: 'notes' })),
          margin: [0, 0, 0, 12],
        },
        {
          columns: [
            {
              stack: [
                { text: 'Seller Sign / Stamp', style: 'signatureTitle' },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1 }] },
              ],
              width: '50%',
            },
            {
              stack: [
                { text: 'Buyer Sign / Stamp', style: 'signatureTitle', alignment: 'right' },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1, lineColor: '#111827' }], alignment: 'right' },
              ],
              width: '50%',
            },
          ],
          margin: [0, 10, 0, 0],
        },
      ],
      styles: {
        companyHeader: {
          fontSize: 18,
          bold: true,
          color: '#0284c7',
        },
        title: {
          fontSize: 20,
          bold: true,
          color: '#0f172a',
        },
        subtitle: {
          fontSize: 9,
          italics: true,
          color: '#64748b',
        },
        badge: {
          fontSize: 10,
          bold: true,
          color: '#ffffff',
          fillColor: '#0284c7',
          margin: [6, 4, 6, 4],
          alignment: 'center',
        },
        sectionLabel: {
          fontSize: 9,
          bold: true,
          color: '#475569',
          margin: [0, 0, 0, 4],
        },
        partyName: {
          fontSize: 13,
          bold: true,
          color: '#0f172a',
        },
        meta: {
          fontSize: 9,
          color: '#475569',
          margin: [0, 2, 0, 0],
        },
        sectionTitle: {
          fontSize: 11,
          bold: true,
          color: '#0f172a',
        },
        notes: {
          fontSize: 9,
          color: '#334155',
          margin: [0, 0, 0, 2],
        },
        tableHeader: {
          bold: true,
          fillColor: '#e2e8f0',
          color: '#0f172a',
          fontSize: 9,
        },
        signatureTitle: {
          fontSize: 9,
          color: '#475569',
          margin: [0, 0, 0, 4],
        },
      },
    };
  }

  public async downloadDealEntryPdf(document: TDocumentDefinitions, fileName = 'deal-entry.pdf'): Promise<void> {
    const api = await this.getPdfMakeApi();
    api.createPdf(document).download(fileName);
  }

  async downloadDualBrokeragePdf(deal: DealPayload): Promise<void> {
    const api = await this.getPdfMakeApi();
    const docDefinition = this.buildDocDefinition(deal);
    api.createPdf(docDefinition).download(`Sauda_${deal.dealNo}_${deal.item}.pdf`);
  }

  async downloadLedgerInvoice(data: {
    dealNo: string;
    dealDate: string;
    sellerName: string;
    buyerName: string;
    motor: number | string;
    itemName: string;
    quantity: number | string;
    unit: string;
    amount: number | string;
    brokerage: number | string;
  }): Promise<void> {
    const api = await this.getPdfMakeApi();
    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [32, 32, 32, 32],
      background: this.pdfPageBorder(),
      content: [
        {
          text: 'JAI BALAJI', style: 'invocation', alignment: 'center', margin: [0, 0, 0, 5],
        },
        {
          svg: this.vikasLogoSvg, width: 250, alignment: 'center', margin: [0, 0, 0, 8],
        },
        {
          text: 'Brokerage Invoice / Ledger Copy', style: 'title', margin: [0, 0, 0, 8],
        },
        {
          table: {
            widths: ['35%', '65%'],
            body: [
              ['Invoice No.', `#${data.dealNo}`],
              ['Date', new Date(data.dealDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
              ['Seller', data.sellerName],
              ['Buyer', data.buyerName],
              ['Item', data.itemName],
              ['Quantity', `${data.quantity} ${data.unit || 'TON'}`],
              ['Motor', `${Number(data.motor || 0)} MOTOR`],
              ['Goods Value', `₹${Number(data.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
              ['Brokerage', `₹${Number(data.brokerage || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
              ['Total Quantity', `${data.quantity} ${data.unit || 'TON'}`],
              ['Total Motor', String(Number(data.motor || 0))],
            ],
          },
          layout: {
            hLineWidth: () => 0.7,
            vLineWidth: () => 0.7,
            hLineColor: () => '#4b5563',
            vLineColor: () => '#4b5563',
            fillColor: (rowIndex: number) => rowIndex % 2 === 0 ? '#f0f1f2' : null,
          },
        },
        this.bankDetailsBlock(),
      ],
      styles: {
        invocation: { fontSize: 10, bold: true, color: '#111827' },
        title: { fontSize: 20, bold: true, color: '#111827', alignment: 'center' },
      },
    };
    api.createPdf(docDefinition).download(`Invoice_${data.dealNo}.pdf`);
  }

  async downloadPartyLedger(data: {
    party: { firmName: string; contactPerson: string; mobile: string; phone: string; address: string; city: string };
    role: 'SELLER' | 'BUYER';
    fromDate: string;
    toDate: string;
    rows: {
      dealNo: string;
      dealDate: string;
      sellerName: string;
      buyerName: string;
      itemName: string;
      quantity: number | string;
      unit: string;
      motor: number | string;
      rate: number | string;
      sellerBrokerage: number | string;
      buyerBrokerage: number | string;
      sellerBrokerageRate: number | string;
      buyerBrokerageRate: number | string;
    }[];
  }): Promise<void> {
    const api = await this.getPdfMakeApi();
    const isSellerLedger = data.role === 'SELLER';
    const total = data.rows.reduce((sum, row) => sum + Number(isSellerLedger ? row.sellerBrokerage : row.buyerBrokerage), 0);
    const totalQuantity = this.totalQuantityByUnit(data.rows);
    const totalMotor = data.rows.reduce((sum, row) => sum + Number(row.motor || 0), 0);
    const dateLabel = (value: string) => this.formatLedgerDate(value);
    const currency = (value: number | string) => `₹${this.formatCurrency(Number(value))}`;
    const partyContact = [data.party.contactPerson, data.party.mobile || data.party.phone].filter(Boolean).join(' | ');
    const partyAddress = [data.party.address, data.party.city].filter(Boolean).join(', ');
    const companyHeader: any[] = [
      { svg: this.vikasLogoSvg, width: 215, alignment: 'center', margin: [0, 6, 0, 0] },
      {
        stack: [
          { text: 'Vikas Broker', fontSize: 16, bold: true },
          { text: 'Address: Thakur Baba Road Dabra-475110, Dist- Gwalior', fontSize: 9, margin: [0, 3, 0, 0] },
          { text: 'Contacts: 8962981111, 7974481260, 9827016804', fontSize: 8.5, margin: [0, 2, 0, 0] },
          { text: 'Email: suniljeevtani00@gmail.com', fontSize: 8.5, bold: true, margin: [0, 2, 0, 0] },
        ],
      },
    ];
    const partyHeader: any[] = [
      {
        stack: [
          { text: data.party.firmName.toUpperCase(), fontSize: 11, bold: true },
          ...(partyContact ? [{ text: partyContact, fontSize: 9, margin: [0, 2, 0, 0] }] : []),
          ...(partyAddress ? [{ text: partyAddress, fontSize: 9, margin: [0, 2, 0, 0] }] : []),
        ],
        margin: [4, 4, 4, 4],
      },
      {
        stack: [
          { text: 'LEDGER', fontSize: 10, bold: true, alignment: 'right' },
          { text: `DATE: ${dateLabel(data.fromDate)} - ${dateLabel(data.toDate)}`, fontSize: 8, alignment: 'right', margin: [0, 4, 0, 0] },
        ],
        margin: [4, 4, 4, 4],
      },
    ];
    const ledgerHeader: any[] = [
      { text: '#', style: 'ledgerHead', alignment: 'center' },
      { text: isSellerLedger ? 'BUYER PARTY' : 'SELLER PARTY', style: 'ledgerHead' },
      { text: 'BROKERAGE', style: 'ledgerHead', alignment: 'right' },
      { text: 'B.RATE', style: 'ledgerHead', alignment: 'right' },
      { text: 'DATE', style: 'ledgerHead', alignment: 'center' },
      { text: 'QTY', style: 'ledgerHead', alignment: 'right' },
      { text: 'MOTOR', style: 'ledgerHead', alignment: 'center' },
      { text: 'QUALITY', style: 'ledgerHead', alignment: 'center' },
      { text: 'RATE', style: 'ledgerHead', alignment: 'right' },
    ];
    const ledgerRows: any[][] = data.rows.map((row, index) => {
      const brokerage = isSellerLedger ? row.sellerBrokerage : row.buyerBrokerage;
      const brokerageRate = isSellerLedger ? row.sellerBrokerageRate : row.buyerBrokerageRate;
      return [
        { text: String(index + 1), alignment: 'center' },
        { text: isSellerLedger ? row.buyerName : row.sellerName },
        { text: currency(brokerage), alignment: 'right' },
        { text: currency(brokerageRate), alignment: 'right' },
        { text: dateLabel(row.dealDate), alignment: 'center' },
        { text: `${Number(row.quantity).toLocaleString('en-IN')} ${row.unit}`, alignment: 'right' },
        { text: `${Number(row.motor || 0)} MOTOR`, alignment: 'center' },
        { text: row.itemName, alignment: 'center' },
        { text: currency(row.rate), alignment: 'right' },
      ];
    });
    const ledgerTotal: any[] = [
      { text: 'TOTAL', colSpan: 2, bold: true, margin: [0, 2, 0, 2] }, {},
      { text: currency(total), bold: true, alignment: 'right', margin: [0, 2, 0, 2] },
      {}, {},
      { text: totalQuantity, bold: true, alignment: 'right', margin: [0, 2, 0, 2] },
      { text: `${totalMotor} MOTOR`, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      {}, {},
    ];
    const document: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [24, 20, 24, 28],
      background: this.pdfPageBorder(),
      content: [
        { text: 'JAI BALAJI', alignment: 'center', bold: true, fontSize: 10, margin: [0, 0, 0, 5] },
        {
          table: {
            widths: ['34%', '66%'],
            body: [companyHeader],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 5],
        },
        {
          table: {
            widths: ['72%', '28%'],
            body: [partyHeader],
          },
          layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#111111', vLineColor: () => '#111111' },
          margin: [0, 0, 0, 0],
        },
        {
          text: `${isSellerLedger ? 'SELLER' : 'BUYER'} BROKERAGE DETAILS`,
          alignment: 'center',
          bold: true,
          fontSize: 12,
          margin: [0, 5, 0, 5],
        },
        {
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: [20, '*', 58, 38, 55, 54, 44, 72, 60],
            body: [ledgerHeader, ...ledgerRows, ledgerTotal],
          },
          layout: {
            hLineWidth: (index: number, node: any) => index === 0 || index === 1 || index === node.table.body.length ? 1 : 0.35,
            vLineWidth: () => 0.55,
            vLineColor: () => '#555555',
            hLineColor: () => '#555555',
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
        },
        {
          text: [
            { text: 'AMOUNT IN WORDS: ', bold: false },
            { text: `RUPEES ${this.amountInWords(total)} ONLY.`, bold: true },
          ],
          fontSize: 9,
          margin: [8, 8, 0, 0],
        },
        this.bankDetailsBlock(),
        { text: 'for, Vikas Broker', alignment: 'right', fontSize: 9, bold: true, margin: [0, 48, 8, 0] },
      ],
      styles: {
        ledgerHead: { fontSize: 8, bold: true, alignment: 'left', fillColor: '#e5e7eb', color: '#111827', margin: [0, 3, 0, 3] },
      },
      defaultStyle: { fontSize: 8.5, color: '#111111' },
    };
    const fileParty = data.party.firmName.replace(/[^a-z0-9]+/gi, '_');
    api.createPdf(document).download(`${isSellerLedger ? 'Seller' : 'Buyer'}_Ledger_${fileParty}.pdf`);
  }

  async openDualBrokeragePdf(deal: DealPayload): Promise<void> {
    const api = await this.getPdfMakeApi();
    const docDefinition = this.buildDocDefinition(deal);
    api.createPdf(docDefinition).open();
  }

  async generatePdfBlob(deal: DealPayload): Promise<Blob> {
    const api = await this.getPdfMakeApi();
    const docDefinition = this.buildDocDefinition(deal);
    return api.createPdf(docDefinition).getBlob();
  }

  private buildDocDefinition(deal: DealPayload): TDocumentDefinitions {
    const makeLedgerPage = (isSeller: boolean): any[] => {
      const party = isSeller ? deal.seller : deal.buyer;
      const counterparty = isSeller ? deal.buyer : deal.seller;
      const brokerage = isSeller ? deal.seller.amount : deal.buyer.amount;
      const brokerageRate = isSeller ? deal.seller.rate : deal.buyer.rate;
      const motorCount = Number(deal.truckNo || 0);
      return [
        { text: 'JAI BALAJI', alignment: 'center', bold: true, fontSize: 10, margin: [0, 0, 0, 5] },
        {
          table: {
            widths: ['34%', '66%'],
            body: [[
              { svg: this.vikasLogoSvg, width: 215, alignment: 'center', margin: [0, 6, 0, 0] },
              {
                stack: [
                  { text: 'Vikas Broker', fontSize: 16, bold: true },
                  { text: 'Address: Thakur Baba Road Dabra-475110, Dist- Gwalior', fontSize: 9, margin: [0, 3, 0, 0] },
                  { text: 'Contacts: 8962981111, 7974481260, 9827016804', fontSize: 8.5, margin: [0, 2, 0, 0] },
                  { text: 'Email: suniljeevtani00@gmail.com', fontSize: 8.5, bold: true, margin: [0, 2, 0, 0] },
                ],
              },
            ]],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 5],
        },
        {
          table: {
            widths: ['72%', '28%'],
            body: [[
              {
                stack: [
                  { text: party.name.toUpperCase(), fontSize: 11, bold: true },
                  { text: `Phone: ${party.phone}`, fontSize: 9, margin: [0, 2, 0, 0] },
                ],
                margin: [4, 4, 4, 4],
              },
              {
                stack: [
                  { text: `NO: ${deal.dealNo}`, fontSize: 10, bold: true, alignment: 'right' },
                  { text: `DATE: ${this.formatLedgerDate(deal.dealDate)}`, fontSize: 8, alignment: 'right', margin: [0, 4, 0, 0] },
                ],
                margin: [4, 4, 4, 4],
              },
            ]],
          },
          layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#111111', vLineColor: () => '#111111' },
        },
        {
          text: `${isSeller ? 'SELLER' : 'BUYER'} BROKERAGE DETAILS`,
          alignment: 'center',
          bold: true,
          fontSize: 12,
          margin: [0, 5, 0, 5],
        },
        {
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: [20, '*', 58, 42, 58, 48, 58, 64, 54],
            body: [
              [
                { text: '#', style: 'ledgerHead', alignment: 'center' },
                { text: isSeller ? 'BUYER PARTY' : 'SELLER PARTY', style: 'ledgerHead' },
                { text: 'BROKERAGE', style: 'ledgerHead', alignment: 'right' },
                { text: 'B.RATE', style: 'ledgerHead', alignment: 'right' },
                { text: 'DATE', style: 'ledgerHead', alignment: 'center' },
                { text: 'QTY', style: 'ledgerHead', alignment: 'right' },
                { text: 'MOTOR', style: 'ledgerHead', alignment: 'center' },
                { text: 'QUALITY', style: 'ledgerHead', alignment: 'center' },
                { text: 'RATE', style: 'ledgerHead', alignment: 'right' },
              ],
              [
                { text: '1', alignment: 'center' },
                { text: counterparty.name },
                { text: this.formatCurrency(brokerage), alignment: 'right' },
                { text: this.formatCurrency(brokerageRate), alignment: 'right' },
                { text: this.formatLedgerDate(deal.dealDate), alignment: 'center' },
                { text: `${Number(deal.quantity).toLocaleString('en-IN')} ${deal.unit}`, alignment: 'right' },
                { text: `${deal.truckNo || '-'} MOTOR`, alignment: 'center' },
                { text: deal.item, alignment: 'center' },
                { text: this.formatCurrency(deal.rate), alignment: 'right' },
              ],
              [
                { text: 'TOTAL', colSpan: 2, bold: true, margin: [0, 2, 0, 2] }, {},
                { text: this.formatCurrency(brokerage), bold: true, alignment: 'right', margin: [0, 2, 0, 2] },
                {}, {},
                { text: `${Number(deal.quantity).toLocaleString('en-IN')} ${deal.unit}`, bold: true, alignment: 'right', margin: [0, 2, 0, 2] },
                { text: `${motorCount} MOTOR`, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
                {}, {},
              ],
            ],
          },
          layout: {
            hLineWidth: (index: number, node: any) => index === 0 || index === 1 || index === node.table.body.length ? 1 : 0.35,
            vLineWidth: () => 0.55,
            vLineColor: () => '#555555',
            hLineColor: () => '#555555',
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
        },
        {
          text: [
            { text: 'AMOUNT IN WORDS: ' },
            { text: `RUPEES ${this.amountInWords(brokerage)} ONLY.`, bold: true },
          ],
          fontSize: 9,
          margin: [8, 8, 0, 0],
        },
        this.bankDetailsBlock(),
      ];
    };

    return {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [24, 20, 24, 50],
      background: this.pdfPageBorder(),
      content: [
        ...makeLedgerPage(true),
        { text: '', pageBreak: 'before' },
        ...makeLedgerPage(false),
      ],
      footer: { text: 'for, Vikas Broker', alignment: 'right', fontSize: 9, bold: true, margin: [0, 0, 32, 24] },
      styles: {
        ledgerHead: { fontSize: 8, bold: true, alignment: 'left', fillColor: '#e5e7eb', color: '#111827', margin: [0, 3, 0, 3] },
      },
      defaultStyle: { fontSize: 8.5, color: '#111111' },
    };
  }

  private formatCurrency(val: number): string {
    return (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private formatLedgerDate(value: string): string {
    const parsedDate = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(parsedDate.getTime())
      ? value
      : parsedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private totalQuantityByUnit(rows: { quantity: number | string; unit: string }[]): string {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const unit = row.unit || 'TON';
      totals.set(unit, (totals.get(unit) || 0) + Number(row.quantity || 0));
    }
    return [...totals.entries()]
      .map(([unit, quantity]) => `${quantity.toLocaleString('en-IN')} ${unit}`)
      .join(' / ');
  }

  private bankDetailsBlock(): any {
    return {
      table: {
        widths: ['*'],
        body: [[{
          margin: [6, 5, 6, 5],
          stack: [
            { text: 'BANK DETAILS', fontSize: 9, bold: true, margin: [0, 0, 0, 3] },
            { text: 'SUNIL KUMAR JEEVTANI', fontSize: 9, bold: true },
            { text: 'A/c no.- 35293586941', fontSize: 8.5, margin: [0, 2, 0, 0] },
            { text: 'IFSC - SBIN0030502', fontSize: 8.5, margin: [0, 2, 0, 0] },
            { text: 'CITY CENTRE BRANCH GWALIOR 474002', fontSize: 8.5, margin: [0, 2, 0, 0] },
          ],
        }]],
      },
      layout: { hLineWidth: () => 0.6, vLineWidth: () => 0, hLineColor: () => '#777777' },
      margin: [0, 10, 0, 0],
    };
  }

  private pdfPageBorder(): any {
    return {
      canvas: [{ type: 'rect', x: 14, y: 14, w: 567, h: 814, lineWidth: 1, lineColor: '#374151' }],
    };
  }

  private amountInWords(amount: number): string {
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    const teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const groupWords = (value: number): string => {
      const words: string[] = [];
      if (value >= 100) {
        words.push(ones[Math.floor(value / 100)], 'HUNDRED');
        value %= 100;
      }
      if (value >= 20) {
        words.push(tens[Math.floor(value / 10)]);
        value %= 10;
      } else if (value >= 10) {
        words.push(teens[value - 10]);
        value = 0;
      }
      if (value > 0) words.push(ones[value]);
      return words.join(' ');
    };
    const labels = ['', 'THOUSAND', 'LAKH', 'CRORE', 'ARAB'];
    let remaining = Math.round(Math.abs(amount));
    if (!remaining) return 'ZERO';
    const groups: string[] = [];
    let groupIndex = 0;
    while (remaining > 0) {
      const groupSize = groupIndex === 0 ? 1000 : 100;
      const group = remaining % groupSize;
      if (group) groups.unshift(`${groupWords(group)}${labels[groupIndex] ? ` ${labels[groupIndex]}` : ''}`);
      remaining = Math.floor(remaining / groupSize);
      groupIndex += 1;
    }
    return groups.join(' ');
  }
}
