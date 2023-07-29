export const FormatDirectory = (dir) => {
  if (dir.includes("C:")) {
    dir = dir.substring(2);
  }
  if (dir.startsWith("\\")) {
    dir = dir.substring(1);
  }

  return dir;
}

export const GetFiles = (dir) => {
  dir = FormatDirectory(dir);
  const result = [];
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(`storage$${dir}\\`)) {
      let itemFileName = key.substring(`storage$${dir}\\`.length);
      if (itemFileName !== "") {
        const itemFileMetadata = JSON.parse(localStorage.getItem(key));
        if (itemFileMetadata.type === "folder") {
          itemFileName = itemFileName.substring(0, itemFileName.length - 1);
        }
        result.push({ name: itemFileName, type: itemFileMetadata.type });
      }
    }
  });

  return result;
};