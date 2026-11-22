// Renders every page of a PDF to PNG (macOS PDFKit) — used for the PDF shots in the film.
// usage: swift pdf-to-png.swift <in.pdf> <out-prefix> [widthPx]
import AppKit
import PDFKit

let args = CommandLine.arguments
guard args.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("usage: pdf-to-png <in.pdf> <out-prefix> [widthPx]\n".data(using: .utf8)!)
  exit(1)
}
let width = args.count > 3 ? Double(args[3])! : 1600
for i in 0..<doc.pageCount {
  let page = doc.page(at: i)!
  let box = page.bounds(for: .mediaBox)
  let scale = width / box.width
  let size = NSSize(width: box.width * scale, height: box.height * scale)
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size.width), pixelsHigh: Int(size.height), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  let ctx = NSGraphicsContext(bitmapImageRep: rep)!
  NSGraphicsContext.current = ctx
  NSColor.white.setFill()
  NSRect(origin: .zero, size: size).fill()
  ctx.cgContext.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: ctx.cgContext)
  NSGraphicsContext.restoreGraphicsState()
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(args[2])-\(i + 1).png"))
}
print("pages: \(doc.pageCount)")
