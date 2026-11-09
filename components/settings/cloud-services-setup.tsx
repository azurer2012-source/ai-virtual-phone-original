"use client";

import { EmailCloudSetup } from "./email-cloud-setup";

export function CloudServicesPage() {
  return <div className="page-menu"><div className="menu-group" style={{ padding: "18px 16px" }}><CloudServicesSetup /></div></div>;
}

/** Personal backup uses email login; provisioning is performed separately by the owner. */
export function CloudServicesSetup({ onConfigChanged }: { onConfigChanged?: () => void }) {
  return <EmailCloudSetup onConfigChanged={onConfigChanged} />;
}
