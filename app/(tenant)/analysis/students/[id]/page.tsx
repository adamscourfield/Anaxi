import { redirect } from "next/navigation";
import type { LegacyQuery } from "@/lib/insights-navigation";
export default async function LegacyStudent({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<LegacyQuery>}) {
const {id}=await params; const query=new URLSearchParams();for(const [key,value] of Object.entries(await searchParams)){if(Array.isArray(value))value.forEach(v=>query.append(key,v));else if(value!==undefined)query.set(key,value);}
redirect("/students/"+encodeURIComponent(id)+(query.size?"?"+query.toString():""));
}
