import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import juan from "@/assets/studio-artists/juan-atkins.jpg.asset.json";
import kevin from "@/assets/studio-artists/kevin-saunderson.jpg.asset.json";
import derrick from "@/assets/studio-artists/derrick-may.jpg.asset.json";
import resistance from "@/assets/studio-artists/underground-resistance.jpg.asset.json";
import jeff from "@/assets/studio-artists/jeff-mills.jpg.asset.json";

const commons = "https://commons.wikimedia.org/wiki/File:";

/**
 * Wall photographs.
 * RELEASE CHECK: every photo listed here needs a documented license or written permission
 * (credit, license and source below) before public release. The Scan 7 photo was removed
 * because it had no stated reuse license; its slot shows an empty frame instead.
 */
const artists = [
  {
    name: "Juan Atkins",
    image: juan,
    credit: "Angie Linder",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    source: `${commons}Juan_Atkins.jpg`,
  },
  {
    name: "Kevin Saunderson",
    image: kevin,
    credit: "Rubens Ben",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: `${commons}Kevin_Saunderson.jpg`,
  },
  {
    name: "Derrick May",
    image: derrick,
    credit: "Natalie Chickee / ThatChickOverThere",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: `${commons}Derrick_May.jpg`,
  },
  {
    name: "Underground Resistance",
    image: resistance,
    credit: "Angie Linder",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    source: `${commons}Underground_Resistance_-_2010_-_10_Critics_in_Detroit_DSC_3815_(4719410705).jpg`,
  },
  {
    name: "Jeff Mills",
    image: jeff,
    credit: "Purplexed",
    license: "Public domain",
    source: `${commons}Jeff_Mills.jpg`,
  },
];

/** Wall art shares the room's measured canvas; it never overlaps equipment or cables. */
export function StudioWallGallery() {
  return (
    <div
      className="studio-wall-gallery"
      role="group"
      aria-label="Detroit techno artists on the studio wall"
    >
      {artists.map((artist, i) => (
        <WallSlot key={artist.name} artist={artist} emptyBefore={i === EMPTY_SLOT} />
      ))}
    </div>
  );
}

/** Index the empty frame sits before, keeping the six-frame wall layout. */
const EMPTY_SLOT = 3;

function WallSlot({
  artist,
  emptyBefore,
}: {
  artist: (typeof artists)[number];
  emptyBefore: boolean;
}) {
  return (
    <>
      {emptyBefore && (
        <div className="studio-artist-frame" aria-hidden="true">
          <span className="studio-artist-photo" />
          <span className="studio-artist-plaque" />
        </div>
      )}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="studio-artist-frame"
            aria-label={`View ${artist.name} wall picture`}
          >
            <span className="studio-artist-photo">
              <img src={artist.image.url} alt={artist.name} width={240} height={180} />
            </span>
            <span className="studio-artist-plaque">{artist.name}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogTitle>{artist.name}</DialogTitle>
          <img src={artist.image.url} alt={artist.name} className="studio-artist-enlarged" />
          <div className="text-xs leading-relaxed text-muted-foreground">
            <p>
              {artist.credit} ·{" "}
              {artist.licenseUrl ? (
                <a href={artist.licenseUrl} target="_blank" rel="noreferrer" className="underline">
                  {artist.license}
                </a>
              ) : (
                artist.license
              )}
            </p>
            <a href={artist.source} target="_blank" rel="noreferrer" className="underline">
              Photograph source
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
