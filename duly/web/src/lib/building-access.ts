import { StrKey } from "@duly/stellar-sdk";

/** Decode only the building ID. A scanned URL is never a navigation target. */
export function parseBuildingLink(value: string): string {
  const input = value.trim();
  let id = input;
  if (!StrKey.isValidContract(id)) {
    const url = new URL(input);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Invalid building link.");
    const values = url.searchParams.getAll("building");
    if (values.length !== 1) throw new Error("Invalid building link.");
    id = values[0];
  }
  if (!StrKey.isValidContract(id)) throw new Error("Invalid building link.");
  return id;
}

export function buildingLink(origin: string, building: string): string {
  if (!StrKey.isValidContract(building)) throw new Error("Invalid building.");
  const url = new URL("/", origin);
  url.searchParams.set("building", building);
  return url.href;
}
