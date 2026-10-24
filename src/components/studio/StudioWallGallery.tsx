import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import juan from "@/assets/studio-artists/juan-atkins.jpg.asset.json";
import kevin from "@/assets/studio-artists/kevin-saunderson.jpg.asset.json";
import derrick from "@/assets/studio-artists/derrick-may.jpg.asset.json";
import scan7 from "@/assets/studio-artists/scan-7.jpg.asset.json";
import resistance from "@/assets/studio-artists/underground-resistance.jpg.asset.json";
import jeff from "@/assets/studio-artists/jeff-mills.jpg.asset.json";

const commons = "https://commons.wikimedia.org/wiki/File:";
const artists = [
  { name: "Juan Atkins", image: juan, credit: "Angie Linder", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: `${commons}Juan_Atkins.jpg` },
  { name: "Kevin Saunderson", image: kevin, credit: "Rubens Ben", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: `${commons}Kevin_Saunderson.jpg` },
  { name: "Derrick May", image: derrick, credit: "Natalie Chickee / ThatChickOverThere", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: `${commons}Derrick_May.jpg` },
  { name: "Scan 7", image: scan7, credit: "Artist photograph via Elypsia Records", license: "Rights retained by the photograph’s owner", source: "https://www.elypsiarecords.com/scan-7/" },
  { name: "Underground Resistance", image: resistance, credit: "Angie Linder", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: `${commons}Underground_Resistance_-_2010_-_10_Critics_in_Detroit_DSC_3815_(4719410705).jpg` },
  { name: "Jeff Mills", image: jeff, credit: "Purplexed", license: "Public domain", source: `${commons}Jeff_Mills.jpg` },
];

/** Wall art shares the room's measured canvas; it never overlaps equipment or cables. */
export function StudioWallGallery() {
  return <div className="studio-wall-gallery" role="group" aria-label="Detroit techno artists on the studio wall">
    {artists.map(artist => <Dialog key={artist.name}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="studio-artist-frame" aria-label={`View ${artist.name} wall picture`}>
          <span className="studio-artist-photo"><img src={artist.image.url} alt={artist.name} width={240} height={180} /></span>
          <span className="studio-artist-plaque">{artist.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogTitle>{artist.name}</DialogTitle>
        <img src={artist.image.url} alt={artist.name} className="studio-artist-enlarged" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <p>{artist.credit} · {artist.licenseUrl ? <a href={artist.licenseUrl} target="_blank" rel="noreferrer" className="underline">{artist.license}</a> : artist.license}</p>
          <a href={artist.source} target="_blank" rel="noreferrer" className="underline">Photograph source</a>
        </div>
      </DialogContent>
    </Dialog>)}
  </div>;
}