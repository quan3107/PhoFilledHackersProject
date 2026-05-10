const quote = (paths) => paths.map((p) => `"${p}"`);

const isStudentOnboarding = (f) =>
  f.includes("apps/student-onboarding/") ||
  f.includes("apps\\student-onboarding\\");

const stripAppPrefix = (f) =>
  f.replace(/^.*apps[/\\]student-onboarding[/\\]/, "");

export default {
  "*.{js,jsx,ts,tsx,mjs,cjs}": (stagedFiles) => {
    const eslintFiles = stagedFiles.filter(isStudentOnboarding);
    const commands = [["prettier", "--write", ...quote(stagedFiles)].join(" ")];
    if (eslintFiles.length > 0) {
      const relativeToApp = eslintFiles.map(stripAppPrefix);
      commands.push(
        `npm --workspace apps/student-onboarding exec eslint -- --fix ${quote(relativeToApp).join(" ")}`
      );
    }
    return commands;
  },
  "*.{json,md,mdx,yml,yaml,css,scss,html}": (stagedFiles) =>
    ["prettier", "--write", ...quote(stagedFiles)].join(" "),
};
