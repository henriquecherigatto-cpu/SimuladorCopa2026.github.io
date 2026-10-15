import Image from "next/image";
import { cn } from "@/lib/utils";

export function PhoneMockup({
  src,
  alt,
  className,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute aspect-[9/19.5] w-[210px] overflow-hidden rounded-[2.1rem] border-[6px] border-brand-black bg-brand-black shadow-2xl sm:w-[240px]",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex justify-center">
        <div className="h-5 w-24 rounded-b-xl bg-brand-black" />
      </div>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="240px"
        priority={priority}
        className="object-cover object-top"
      />
    </div>
  );
}
