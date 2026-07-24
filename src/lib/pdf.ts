export const loadPdfTools = async () => {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const autoTable = (autoTableModule as { default?: unknown }).default ?? autoTableModule;
  return {
    jsPDF,
    autoTable: autoTable as (doc: unknown, options: unknown) => void,
  };
};
