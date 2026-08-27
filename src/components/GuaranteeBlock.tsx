import { guarantee } from "@/lib/content";
import { ShieldIcon } from "./icons";

export function GuaranteeBlock() {
  return (
    <section className="bg-navy py-16 sm:py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white">
          <ShieldIcon className="h-8 w-8" />
        </div>
        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {guarantee.title}
        </h2>
        <p className="mt-4 text-base text-white/70 sm:text-lg">{guarantee.text}</p>
        <p className="mt-6 inline-flex rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white/85">
          {guarantee.pill}
        </p>
      </div>
    </section>
  );
}
