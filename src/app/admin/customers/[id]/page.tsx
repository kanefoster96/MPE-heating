import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomer } from "../../mockData";
import { CustomerProfile } from "./CustomerProfile";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = getCustomer(id);
  return { title: customer ? customer.name : "Customer" };
}

export default async function CustomerProfilePage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const customer = getCustomer(id);
  if (!customer) notFound();

  return <CustomerProfile customerId={id} />;
}
