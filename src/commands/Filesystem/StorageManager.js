export const FormatDirectory = (dir) => {
  return "C:" + dir.replaceAll("/", "\\");
}
export const PrepareInternal = (dir) => {
  if (dir.toUpperCase().startsWith("C:")) {
    dir = dir.substring(2);
  }
  return dir.replaceAll("\\", "/");
}