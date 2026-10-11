import Link from "next/link";
import { requireSuperAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import styles from "./god.module.css";

export default async function GodDashboardPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  await requireSuperAdminUser();
  const query=await searchParams??{};
  const q=typeof query.q==="string"?query.q.trim():"";
  const status=typeof query.status==="string"&&["ACTIVE","PAUSED","ARCHIVED"].includes(query.status)?query.status:"";
  const [schools,admins]=await Promise.all([
    prisma.tenant.findMany({orderBy:{name:"asc"},include:{features:{where:{enabled:true},select:{key:true}},users:{where:{role:"ADMIN"},select:{id:true}}}}),
    prisma.user.count({where:{role:"SUPER_ADMIN",isActive:true}}),
  ]);
  const visible=schools.filter(s=>(!status||s.status===status)&&(!q||`${s.name} ${s.slug??""}`.toLowerCase().includes(q.toLowerCase())));
  return <div className={styles.page}>
    <PageHeader variant="ledger" eyebrow="Platform workspace" title="Schools" subtitle="Manage school access, modules and connections." actions={<Link href="/god/schools/new" className={styles.primaryLink}>+ Create school</Link>}/>
    <dl className={styles.stats}>{[["Schools",schools.length],["Active schools",schools.filter(s=>s.status==="ACTIVE").length],["Super users",admins]].map(([label,count])=><div key={label} className={styles.stat}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
    <form method="get" action="/god" className={styles.toolbar}><label>Find a school<input type="search" name="q" placeholder="School name or slug…" defaultValue={q}/></label><label>Status<select name="status" defaultValue={status}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="ARCHIVED">Archived</option></select></label><button type="submit">Search</button>{(q||status)&&<Link href="/god" className="text-xs text-muted">Clear</Link>}</form>
    <section className={styles.ledger} aria-label="School directory"><div className={styles.ledgerTop}><span>{visible.length} school{visible.length===1?"":"s"}</span><span>Select a school to manage</span></div>{visible.map(s=><Link href={`/god/schools/${s.id}`} key={s.id} className={styles.schoolRow}><div><h2>{s.name}</h2><p>{s.slug??"No slug set"}</p></div><span className={styles.status} data-active={s.status==="ACTIVE"}>{s.status.toLowerCase()}</span><span className={styles.adminCount}>{s.users.length} admins</span><span className={styles.moduleCount}>{s.features.length} modules</span><span aria-hidden="true">→</span></Link>)}{!visible.length&&<p className={styles.empty}>No schools match these filters. <Link href="/god">Clear filters →</Link></p>}</section>
  </div>;
}
