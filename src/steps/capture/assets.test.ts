import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extensionFromContentType,
  hasIconUrlMarker,
  isPhotoCandidateEligible,
  isSvgUrl,
  largestFromSrcset,
  resolveExtension,
  sniffImageExtension,
  sortByAreaDesc,
  type ImageCandidate,
} from "./assetsHelpers.js";

describe("assetsHelpers", () => {
  it("rejects SVG photo URLs", () => {
    assert.equal(isSvgUrl("https://cdn.example/a.svg"), true);
    assert.equal(
      isPhotoCandidateEligible({
        url: "https://cdn.example/chevron.svg",
        width: 800,
        height: 600,
        kind: "photo",
      }),
      false
    );
  });

  it("rejects icon URL markers", () => {
    assert.equal(hasIconUrlMarker("https://x.com/icons/arrow.png"), true);
    assert.equal(
      isPhotoCandidateEligible({
        url: "https://x.com/media/arrow-right.png",
        width: 800,
        height: 600,
        kind: "photo",
      }),
      false
    );
  });

  it("rejects small natural dimensions for photos", () => {
    assert.equal(
      isPhotoCandidateEligible({
        url: "https://x.com/big.jpg",
        width: 100,
        height: 100,
        kind: "photo",
      }),
      false
    );
  });

  it("allows large raster photos and unknown natural size", () => {
    assert.equal(
      isPhotoCandidateEligible({
        url: "https://x.com/project.jpg",
        width: 1200,
        height: 800,
        kind: "photo",
      }),
      true
    );
    assert.equal(
      isPhotoCandidateEligible({
        url: "https://x.com/lazy.webp",
        width: 0,
        height: 0,
        kind: "photo",
      }),
      true
    );
  });

  it("sorts by area descending", () => {
    const list: ImageCandidate[] = [
      { url: "a", width: 100, height: 100, kind: "photo" },
      { url: "b", width: 800, height: 600, kind: "photo" },
      { url: "c", width: 400, height: 400, kind: "photo" },
    ];
    assert.deepEqual(
      sortByAreaDesc(list).map((c) => c.url),
      ["b", "c", "a"]
    );
  });

  it("maps content-type to extension", () => {
    assert.equal(extensionFromContentType("image/jpeg; charset=binary"), ".jpg");
    assert.equal(extensionFromContentType("image/png"), ".png");
    assert.equal(extensionFromContentType("image/webp"), ".webp");
    assert.equal(extensionFromContentType("image/svg+xml"), ".svg");
  });

  it("sniffs JPEG/PNG magic bytes", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(sniffImageExtension(jpeg), ".jpg");
    assert.equal(sniffImageExtension(png), ".png");
    assert.equal(
      sniffImageExtension(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")),
      ".svg"
    );
  });

  it("resolveExtension prefers content-type then sniff", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    assert.equal(resolveExtension("image/webp", jpeg, "https://x.com/a"), ".webp");
    assert.equal(resolveExtension(null, jpeg, "https://x.com/a"), ".jpg");
  });

  it("largestFromSrcset picks widest descriptor", () => {
    assert.equal(
      largestFromSrcset(
        "small.jpg 400w, large.jpg 1200w, medium.jpg 800w"
      ),
      "large.jpg"
    );
  });
});
