import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { business } from "./content";

// Shared by src/app/opengraph-image.tsx and src/app/twitter-image.tsx —
// Next.js requires the actual `default`/`alt`/`size`/`contentType`
// exports to live in those exact filenames, so this holds the real
// implementation and both files just re-export it.
export const alt = business.fullName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateOgImage() {
  const logoPath = join(process.cwd(), "public", "mpe-logo.png");
  const logoBase64 = readFileSync(logoPath).toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f5c244 0%, #e8623a 40%, #cf5029 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${logoBase64}`}
          width={520}
          height={224}
          alt=""
          style={{ objectFit: "contain" }}
        />
        <div
          style={{
            marginTop: 32,
            fontSize: 40,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          Boiler Repairs, Servicing & More
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 28,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          Across the North East
        </div>
      </div>
    ),
    { ...size }
  );
}
