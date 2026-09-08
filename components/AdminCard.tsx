import Link from "next/link";
// Compatibility wrapper: consequential administration now uses server-checked APIs.
export function AdminCard({app}:{app:{id:string;trading_name:string}}){
  return <article className="panel"><h2 className="font-bold">{app.trading_name}</h2><Link className="btn-secondary mt-3" href={`/admin?view=listings&q=${encodeURIComponent(app.trading_name)}`}>Review in admin workspace</Link></article>;
}
