import Link from "next/link";
export type Claim={id:string;plumber_id:string;claimant_id:string;phone_entered:string;status:string;created_at:string;admin_notes:string|null;plumber?:{trading_name:string;area:string;whatsapp_number:string;slug:string|null};claimant?:{full_name:string|null;email:string}};
// Compatibility wrapper; no direct client-side ownership transfers or role updates.
export function ClaimCard({claim}:{claim:Claim}){
  return <article className="panel"><h2 className="font-bold">{claim.plumber?.trading_name||"Ownership request"}</h2><p className="mt-2 text-sm">{claim.status}</p><Link className="btn-secondary mt-3" href="/admin?view=claims&filter=pending">Review ownership evidence</Link></article>;
}
