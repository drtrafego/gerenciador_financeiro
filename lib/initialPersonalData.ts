import { ExtractedTransactionItem } from "./ai/receiptScanner";

let initialData: ExtractedTransactionItem[] = [];

try {
  const local = require("./localData");
  if (local && Array.isArray(local.LOCAL_TRANSACTIONS)) {
    initialData = local.LOCAL_TRANSACTIONS;
  }
} catch {
  initialData = [];
}

export const INITIAL_LOCAL_TRANSACTIONS = initialData;
