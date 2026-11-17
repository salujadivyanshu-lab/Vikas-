import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { DealEntryComponent } from './features/deal-entry/deal-entry.component';
import { LoginComponent } from './features/login/login.component';
import { ItemMasterComponent } from './features/item-master/item-master.component';
import { PartyMasterComponent } from './features/party-master/party-master.component';
import { PaymentReceiptComponent } from './features/payment-receipt/payment-receipt.component';
import { ReportsComponent } from './features/reports/reports.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'new-deal', component: DealEntryComponent, canActivate: [authGuard] },
  { path: 'receipts', component: PaymentReceiptComponent, canActivate: [authGuard] },
  { path: 'parties', component: PartyMasterComponent, canActivate: [authGuard] },
  { path: 'items', component: ItemMasterComponent, canActivate: [authGuard] },
  { path: 'reports', component: ReportsComponent, canActivate: [authGuard] },
];
