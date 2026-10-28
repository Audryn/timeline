"use client";

import { useState } from "react";

export function useRequestState(initialBusy = false) {
  const [busy, setBusy] = useState(initialBusy);
  const [error, setError] = useState("");
  return { busy, setBusy, error, setError };
}
