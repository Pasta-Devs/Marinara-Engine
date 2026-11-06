export function isSpriteImageFile(file: Pick<File, "name">): boolean {
  return /\.(png|jpg|jpeg|gif|webp|avif|svg)$/iu.test(file.name);
}
