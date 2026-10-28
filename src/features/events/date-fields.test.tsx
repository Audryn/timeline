// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { DateFields } from "./date-fields";
import { emptyDate, parseDate, type DateDraft } from "./form";

it("offers labeled date controls and keeps hidden ongoing/custom values out of the selected date", async () => {
  const user = userEvent.setup();
  const changed = vi.fn<(value: DateDraft) => void>();
  function Editor() {
    const [date, setDate] = useState(emptyDate);
    return <DateFields value={date} hemisphere="southern" onChange={(value) => {
      changed(value);
      setDate(value);
    }} />;
  }
  render(<Editor />);
  const currentDate = () => {
    const call = changed.mock.calls.at(-1);
    if (!call) throw new Error("Expected an edited date.");
    return parseDate(call[0]);
  };

  expect(screen.getByRole("group", { name: "When did it happen?" })).toBeTruthy();
  expect(screen.getByText(/This memory will appear in Undated/)).toBeTruthy();
  await user.selectOptions(screen.getByRole("combobox", { name: "Date type" }), "range");
  await user.type(screen.getByRole("spinbutton", { name: "Start year" }), "2020");
  await user.type(screen.getByRole("spinbutton", { name: "End year" }), "2022");
  await user.click(screen.getByRole("checkbox", { name: "Still ongoing" }));

  expect(screen.queryByRole("spinbutton", { name: "End year" })).toBeNull();
  expect(currentDate()).toEqual({
    kind: "range", start: { year: 2020 }, end: null, approximate: false,
  });
  await user.click(screen.getByRole("checkbox", { name: "Still ongoing" }));
  expect((screen.getByRole("spinbutton", { name: "End year" }) as HTMLInputElement).value).toBe("2022");

  await user.selectOptions(screen.getByRole("combobox", { name: "Date type" }), "custom");
  await user.type(screen.getByRole("textbox", { name: "Date wording" }), "The academy years");
  expect(screen.queryByRole("checkbox", { name: "This is approximate" })).toBeNull();
  expect(screen.queryByRole("spinbutton", { name: "Start year" })).toBeNull();
  expect(currentDate()).toEqual({
    kind: "custom", text: "The academy years", start: null, end: null,
  });
  await user.click(screen.getByRole("checkbox", { name: "Add approximate timeline placement" }));
  expect(currentDate()).toEqual({
    kind: "custom", text: "The academy years", start: { year: 2020 }, end: { year: 2022 },
  });
  await user.click(screen.getByRole("checkbox", { name: "Add approximate timeline placement" }));
  expect(currentDate()).toEqual({
    kind: "custom", text: "The academy years", start: null, end: null,
  });

  await user.selectOptions(screen.getByRole("combobox", { name: "Date type" }), "unknown");
  expect(screen.queryByRole("textbox", { name: "Date wording" })).toBeNull();
  expect(screen.getByText(/This memory will appear in Undated/)).toBeTruthy();
  expect(currentDate()).toEqual({ kind: "unknown" });
});
