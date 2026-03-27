import React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft } from "lucide-react";

type Props = {
  tx: {
    id: string;
    date: string;
    type: string;
    description?: string;
    amount: number;
    sourceAccount?: string;
    destinationAccount?: string;
    accountDetails?: string;
    status?: string;
  };
  formatDate: (iso: string) => string;
  formatAmount: (n: number) => string;
  formatAccountName: (acc?: string) => string;
  labelMap?: (type: string) => string;
};

const FinancialTxCard: React.FC<Props> = ({ tx, formatDate, formatAmount, formatAccountName, labelMap }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm app-panel">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="capitalize">
          {labelMap ? labelMap(tx.type) : tx.type}
        </Badge>
        <span className="text-xs text-slate-500">{formatDate(tx.date)}</span>
      </div>
      <p className="text-sm font-semibold text-slate-800 mt-1">{tx.description || "-"}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className={`text-sm font-bold ${tx.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {formatAmount(tx.amount)}
        </span>
        <Badge className="bg-blue-100 text-blue-700 border-none capitalize">{tx.status}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
        <span>
          {tx.sourceAccount === "autre" && tx.accountDetails ? `Autre (${tx.accountDetails})` : formatAccountName(tx.sourceAccount)}
        </span>
        {tx.destinationAccount && (
          <>
            <ArrowRightLeft className="h-3 w-3 text-slate-400" />
            <span>
              {tx.destinationAccount === "autre" && tx.accountDetails
                ? `Autre (${tx.accountDetails})`
                : formatAccountName(tx.destinationAccount)}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default FinancialTxCard;
