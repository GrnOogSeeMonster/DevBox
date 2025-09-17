"use client";
import React, { useState } from "react";
import WizardClient from "./WizardClient";

export default function WizardPage() {
  const [open, setOpen] = useState(true);
  return (
    <>
      {open && <WizardClient onClose={() => { setOpen(false); history.back(); }} />}
    </>
  );
}
