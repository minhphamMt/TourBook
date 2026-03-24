import { LoginPanel } from "@/components/site/login-panel"

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export const dynamic = "force-dynamic"

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams
  const redirectTo = readParam(query.redirect)

  return <LoginPanel redirectTo={redirectTo || undefined} />
}
