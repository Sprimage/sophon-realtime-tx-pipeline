export type TxStatus = 'pending' | 'included' | 'dropped';

export type IngestedTx =
  | { status: 'pending'; hash: string; firstSeenMs: number }
  | {
      status: 'included';
      hash: string;
      firstSeenMs: number; 
      includedBlock: number;
      includedAtMs: number;
      from?: string | null;
      to?: string | null;
      valueWei?: string | null;
      feeWei?: string | null;
    };
