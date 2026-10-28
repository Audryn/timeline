/**
 * Framework-neutral design values. Compatibility entries preserve the existing
 * web UI exactly; they are migration debt, not an expanded canonical scale.
 */
export const tokens = {
  colors: {
    light: {
      brand: { forest: "#216353", hover: "#184d40", gold: "#9a6b2e" },
      neutral: {
        paper: "#f6f4ed", ink: "#233c35", muted: "#627269",
        line: "#d9dfd5", surface: "#fffefa", white: "#fff", transparent: "transparent",
      },
      semantic: {
        success: { foreground: "#216353", background: "#eef3e9", border: "#d5dfd0" },
        warning: { foreground: "#705727", background: "#fbf6e9", border: "#e1d3b7" },
        error: { foreground: "#923d31", background: "#fff2ed", border: "#e6c9c1" },
      },
      compatibility: {
        softGreen: "#e9efe5", selection: "#d2e3ce", brandRail: "#96b3a0",
        brandDot: "#9aaf87", headerBorder: "#cbd4c7", paperBorder: "#d8decf",
        paperStack: "#e9ecdf", paperStar: "#8d996e", storyRail: "#d4dfcc",
        promptBorder: "#d3decb", promptSurface: "#eff3e9", footnoteBorder: "#e4e7dc",
        featureIndex: "#52664b", stepBorder: "#d0dcc8", stepSurface: "#edf1e6",
        accountBorder: "#d9dfd2", inputBorder: "#cdd6c9", placeholder: "#7b887d",
        inputDisabled: "#f2f3ed", buttonDisabledBorder: "#d4dbce",
        buttonDisabledSurface: "#e8ece2", buttonDisabledText: "#66715f",
        secondaryBorder: "#ced8c8", secondaryHover: "#edf2e8",
        workspaceMuted: "#617069", workspaceSecondaryBorder: "#c9d6cb",
        workspaceBorder: "#d5dfd4", workspaceInk: "#233b37", emptyBorder: "#c3d3c5",
        emptySurface: "#fbfcf8", badgeSurface: "#e6f0e9",
        workspaceError: "#8b3034", workspaceErrorSurface: "#fff1ef",
        workspaceErrorBorder: "#e4bdb7", workspaceSuccess: "#285c4e",
        workspaceSuccessSurface: "#e9f1e7", workspaceSuccessBorder: "#c8ddc8",
        workspaceInputBorder: "#cbd6cd", fieldsetBorder: "#dbe3d9",
        conflictBorder: "#d9b55d", conflictSurface: "#fffbef", peopleSurface: "#eeeee4",
        pillBorder: "#c8dacb", timelineRail: "#c7d9c9", eventDotBorder: "#f5f3ed",
      },
    },
    // Available for an explicitly approved future theme, never OS-activated.
    dark: {
      brand: { forest: "#94c9b3", hover: "#b1deca", gold: "#dbb77c" },
      neutral: {
        paper: "#17221d", ink: "#e9eee7", muted: "#a9b8ad",
        line: "#3a4b40", surface: "#213028", white: "#fff", transparent: "transparent",
      },
      semantic: {
        success: { foreground: "#a8d5b3", background: "#253b2d", border: "#4b7255" },
        warning: { foreground: "#edcd93", background: "#3c3323", border: "#8c7448" },
        error: { foreground: "#f1b1a6", background: "#432b28", border: "#96645c" },
      },
    },
  },
  spacing: { 1: "4px", 2: "8px", 4: "16px", 6: "24px", 8: "32px" },
  typeScale: { caption: "12px", small: "14px", body: "16px", heading: "24px", title: "32px" },
  fontFamily: {
    sans: '"Segoe UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
  },
  fontWeight: { regular: "400", semibold: "600", bold: "700" },
  lineHeight: { body: "1.6", heading: "1.2", single: "1" },
  radii: { control: "8px", card: "16px", circle: "50%" },
  shadows: {
    story: "0 16px 45px #34482f06, 7px 8px 0 -1px #e9ecdf",
    account: "0 12px 42px #30452f05",
    project: "0 6px 20px #233b3705",
  },
  compatibility: {
    spacing: {
      1: "1px", 2: "2px", 3: "3px", 5: "5px", 6: "6px", 7: "7px",
      9: "9px", 10: "10px", 11: "11px", 12: "12px", 13: "13px", 14: "14px",
      15: "15px", 17: "17px", 18: "18px", 19: "19px", 20: "20px", 21: "21px",
      22: "22px", 23: "23px", 25: "25px", 26: "26px", 27: "27px", 28: "28px",
      30: "30px", 33: "33px", 34: "34px", 35: "35px", 36: "36px", 38: "38px",
      40: "40px", 42: "42px", 44: "44px", 45: "45px", 48: "48px", 50: "50px",
      60: "60px", 70: "70px", 76: "76px", 85: "85px", 95: "95px",
      negative4: "-4px", negative10: "-10px",
      heroGap: "clamp(40px, 7vw, 100px)",
      accountGap: "clamp(40px, 8vw, 115px)",
      underline: "0.2em",
    },
    fontSize: {
      px9: "9px", px10: "10px", px11: "11px", px13: "13px", px17: "17px",
      px19: "19px", px21: "21px", px27: "27px", px28: "28px", px30: "30px",
      px36: "36px", px64: "64px",
      hero: "clamp(58px, 6.5vw, 85px)", heroMobile: "clamp(58px, 12vw, 78px)",
      introduction: "clamp(38px, 4.2vw, 53px)",
      workspaceHeading: "clamp(2rem, 5vw, 3.2rem)", emptyHeading: "clamp(1.5rem, 4vw, 2rem)",
      rem07: ".7rem", rem085: ".85rem", rem09: ".9rem", rem2: "2rem",
      rem081: ".81rem", rem1: "1rem", rem075: ".75rem", rem14: "1.4rem",
      rem072: ".72rem", rem135: "1.35rem", rem095: ".95rem", rem08: ".8rem",
    },
    fontWeight: { medium: "650", heavy: "750" },
    lineHeight: {
      hero: "1.04", relaxed: "1.8", story: "1.25", compact: "1.4", prose: "1.7",
      copy: "1.75", introduction: "1.12", introCopy: "1.85", accountTitle: "1.16", control: "1.5",
    },
    letterSpacing: {
      brand: "-1.2px", eyebrow: "1.8px", hero: "-3.8px", overline: "1.6px",
      story: "-0.8px", prompt: "1.2px", section: "-0.6px", heroMobile: "-3px",
      accountEyebrow: "1.7px", introduction: "-1.7px", accountTitle: "-0.9px",
      workspaceHeading: "-.05em", workspaceEyebrow: ".14em", workspaceSection: "-.03em",
      editor: "-.04em", event: "-.025em",
    },
    radii: { 7: "7px", 9: "9px", 10: "10px", 12: "12px", 18: "18px", 20: "20px" },
  },
} as const;

/** CSS variable names are stable across the generator and Tailwind adapter. */
export function tokenVariable(path: string): string {
  return `--${path.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replaceAll(".", "-")}`;
}
