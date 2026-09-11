import React, { useState } from 'react';
import { useVendor } from '../../context/VendorContext';
import { usePermissions } from '../../hooks/usePermissions';
import { SegmentedControl } from '../../components/ui';
import { VendorContractsTab } from './vendor/VendorContractsTab';
import { VendorTermsTab } from './vendor/VendorTermsTab';
import { VendorBillsTab } from './vendor/VendorBillsTab';
import { VendorPaymentsTab } from './vendor/VendorPaymentsTab';
import { VendorHutangTab } from './vendor/VendorHutangTab';
import { VendorAuditTab } from './vendor/VendorAuditTab';
import { VendorBill, VendorPaymentTerm, ProjectVendor } from '../../types';

interface ProjectVendorViewProps {
  projectId: string;
}

export function ProjectVendorView({ projectId }: ProjectVendorViewProps) {
  const { loadingVendor } = useVendor();
  const { canViewFinance, canViewVendorCost } = usePermissions();
  const [activeTab, setActiveTab] = useState('kontrak');

  // Inter-tab trigger state (e.g. clicking "Bayar" on a bill switches to "pembayaran" tab)
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<VendorBill | null>(null);

  const canView = canViewVendorCost() || canViewFinance();

  if (!canView) {
    return (
      <div className="p-8 text-center text-[var(--color-text-secondary)]">
        Anda tidak memiliki akses ke modul Vendor proyek ini.
      </div>
    );
  }

  if (loadingVendor) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handlePayBillFromBillsTab = (bill: VendorBill) => {
    setSelectedBillForPayment(bill);
    setActiveTab('pembayaran');
  };

  return (
    <div className="space-y-6">
      <SegmentedControl
        options={[
          { label: 'Kontrak', value: 'kontrak' },
          { label: 'Cara Bayar', value: 'termin' },
          { label: 'Tagihan', value: 'tagihan' },
          { label: 'Pembayaran', value: 'pembayaran' },
          { label: 'Laporan Hutang', value: 'hutang' },
          { label: 'Audit Log', value: 'audit' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
        {activeTab === 'kontrak' && (
          <VendorContractsTab projectId={projectId} />
        )}
        {activeTab === 'termin' && (
          <VendorTermsTab projectId={projectId} />
        )}
        {activeTab === 'tagihan' && (
          <VendorBillsTab 
            projectId={projectId} 
            onPayBill={handlePayBillFromBillsTab}
          />
        )}
        {activeTab === 'pembayaran' && (
          <VendorPaymentsTab 
            projectId={projectId} 
            initialSelectedBill={selectedBillForPayment}
            onClearSelectedBill={() => setSelectedBillForPayment(null)}
          />
        )}
        {activeTab === 'hutang' && (
          <VendorHutangTab projectId={projectId} />
        )}
        {activeTab === 'audit' && (
          <VendorAuditTab projectId={projectId} />
        )}
      </div>
    </div>
  );
}
