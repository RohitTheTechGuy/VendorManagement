import { http } from "./http.js";
import { uploadFile } from "./files-api.js";

// Upload a contract PDF then post it to the given contract action endpoint.
async function uploadAnd(contractId: string, action: string, file: File): Promise<void> {
  const uploaded = await uploadFile(file, "contract");
  await http.post(`/api/contracts/${contractId}/${action}`, {
    fileBlobId: uploaded.fileBlobId,
    fileName: uploaded.fileName,
  });
}

// Legal (buyer) actions
export const uploadDraft = (contractId: string, file: File) => uploadAnd(contractId, "draft", file);
export const uploadRevision = (contractId: string, file: File) => uploadAnd(contractId, "revise", file);
export const buyerSign = (contractId: string, file: File) => uploadAnd(contractId, "buyer-sign", file);

// Vendor actions
export async function vendorRequestChanges(contractId: string, comment: string): Promise<void> {
  await http.post(`/api/contracts/${contractId}/request-changes`, { comment });
}
export async function vendorAgree(contractId: string): Promise<void> {
  await http.post(`/api/contracts/${contractId}/agree`);
}
export const vendorSign = (contractId: string, file: File) => uploadAnd(contractId, "vendor-sign", file);
