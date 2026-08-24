import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "user";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Disposable email blocklist ─────────────────────────────────────────────────
// Common throwaway / temporary email domains. Lowercase, no dots at start/end.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info", "sharklasers.com",
  "guerrillamailblock.com", "grr.la", "guerrillamail.in", "spam4.me", "trashmail.com",
  "trashmail.at", "trashmail.io", "trashmail.me", "trashmail.net", "trashmail.org",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "temp-mail.ru", "dispostable.com",
  "mailnull.com", "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
  "yopmail.com", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc",
  "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf",
  "monemail.fr.nf", "monmail.fr.nf", "mailnesia.com", "mailnull.com", "spamfree24.org",
  "spamfree24.de", "spamfree24.eu", "spamfree24.info", "spamfree24.biz", "spamfree24.net",
  "discard.email", "discardmail.com", "discardmail.de", "spamspot.com", "spamstack.net",
  "throwam.com", "throwaway.email", "throwawaymailaddress.com", "throwam.com",
  "getairmail.com", "filzmail.com", "spamthisplease.com", "fakeinbox.com", "fakemailz.com",
  "mt2015.com", "mt2014.com", "spamfree.eu", "no-spam.ws", "spamwc.de", "spam.la",
  "spam.su", "s0ny.net", "snkmail.com", "skeefmail.com", "sharklasers.com", "shitmail.me",
  "put2.net", "proxymail.eu", "pookmail.com", "pjjkp.com", "pepbot.com", "owlpic.com",
  "objectmail.com", "obobbo.com", "nwldx.com", "notsharingmy.info", "nobody.dnsalias.com",
  "nospamfor.us", "nospam4.us", "nospammail.net", "nospam.ze.tc", "nospam.today",
  "mohmal.com", "mailzilla.org", "mailzilla.com", "mailin8r.com", "mailinatot.com",
  "mailimate.com", "mailhz.me", "mailforspam.com", "mailfree.net", "mailfall.com",
  "maildrop.cc", "maildu.de", "mailcloak.com", "mailblocks.com", "mail.mezimages.net",
  "mail-filter.com", "lovemeleaveme.com", "lopl.co.cc", "lookugly.com", "lifebyfood.com",
  "letthemeatspam.com", "kurzepost.de", "koszmail.pl", "klassmaster.com", "klzlk.com",
  "klxkl.com", "jetable.net", "jetable.org", "jetable.pp.ua", "jetable.de",
  "iraqmail.com", "inoutmail.eu", "inoutmail.de", "inoutmail.info", "inoutmail.net",
  "imail.org", "ihateyoualot.info", "hat-geld.de", "haltospam.com", "harakirimail.com",
  "hailmail.net", "gowikibooks.com", "gowikicampus.com", "gowikicars.com",
  "gowikifilms.com", "gowikigames.com", "gowikimusic.com", "gowikinetwork.com",
  "gowikitravel.com", "gowikitv.com", "great-host.in", "grapesoi.com", "getthere.space",
  "gero.us", "get2mail.fr", "genderfuck.net", "gedmail.win", "gdfmail.com", "garliclife.com",
  "freundin.ru", "fromru.com", "freemail.ms", "freemails.me", "freemail.hu", "free-email.cf",
  "fleckens.hu", "fightallspam.com", "fir.hk", "filzmail.com", "filzmail.de",
  "fakeinformation.com", "fake-box.com", "f4k.es", "eyepaste.com", "etranquil.com",
  "etranquil.net", "etranquil.org", "esgeneri.com", "emz.net", "email60.com", "email4spam.com",
  "email-fake.com", "dsimon.com", "drdrb.com", "dodgeit.com", "dispostable.com",
  "discardmail.de", "dingbone.com", "dicesmail.com", "devnullmail.com", "despam.it",
  "deadaddress.com", "deadfake.cf", "deadfake.ga", "deadfake.ml", "deadfake.tk",
  "dacoolest.com", "daemsteam.com", "daemsteam.net", "daisys.farm", "danceml.com",
  "dandikmail.com", "danh.xyz", "darkharvestfilms.com", "dash-pads.com", "datazo.ca",
  "deadspam.com", "despam.it", "directmail24.org", "discardmail.com",
  "dontsendmespam.de", "dumpmail.de", "dumpyemail.com", "e4ward.com", "easytrashmail.com",
  "emiganto.com", "emailigo.com", "emailinfive.com", "emailisvalid.com", "emailmiser.com",
  "emailsensei.com", "emailtmp.com", "emailwarden.com", "emailxfer.com", "emkei.cz",
  "emkei.ga", "emkei.gq", "emkei.ml", "emkei.tk", "emz.net", "ezfill.net",
  "ezstest.com", "fakemailgenerator.com", "fastacura.com", "fastchevy.com", "fastchrysler.com",
  "fastkawasaki.com", "fastmazda.com", "fastmitsubishi.com", "fastnissan.com", "fastsubaru.com",
  "fastsuzuki.com", "fasttoyota.com", "fastyamaha.com", "fightallspam.com", "fiifke.de",
  "filzmail.com", "firemailbox.club", "fizmail.com", "fleckens.hu", "fml.ru", "fqhq.org",
  "fr33mail.info", "frapmail.com", "freeblackbootytube.com", "fuckingdildo.com", "fux0ringduh.com",
  "get1mail.com", "getairmail.com", "getonemail.com", "gishpuppy.com", "giveh.com", "glubex.com",
  "glucosegrin.com", "gmailnew.com", "gmx.de", "goemailgo.com", "gotmail.com", "gotmail.net",
  "gotmail.org", "great-host.in", "greensloth.com", "gustr.com", "h.mintemail.com",
  "haltospam.com", "hartbot.de", "hat-geld.de", "hmamail.com", "hochsitze.com", "hopemail.biz",
  "hornyalwary.top", "hulapla.de", "hurify1.com", "ieatspam.eu", "ieatspam.info", "ieh-mail.de",
  "ihateyoualot.info", "iheartspam.org", "ikbenspamvrij.nl", "imails.info", "inbax.tk",
  "inbox.si", "inboxalias.com", "incognitomail.com", "incognitomail.net", "incognitomail.org",
  "instant-mail.de", "instantemailaddress.com", "instantlyemail.com", "jnxjn.com",
  "jobbikmadaras.hu", "junk.to", "junkmail.ga", "junkmail.gq", "just4fun.de", "jnxjn.com",
  "kasmail.com", "kaspop.com", "keepmymail.com", "killmail.com", "killmail.net",
  "kir.ch.tc", "klassmaster.com", "kleptz.com", "klzlk.com", "knol-power.nl", "kook.ml",
  "kpnmail.nl", "kurzepost.de", "lalasd.ml", "lastmail.co", "lazy.dnsalias.com",
  "letthemeatspam.com", "lol.ovpn.to", "lolfreak.net", "lookugly.com", "lortemail.dk",
  "lovemeleaveme.com", "lr78.com", "lukop.dk", "m21.cc", "mail-easy.fr", "mail-filter.com",
  "mail-me.com", "mail-temporaire.com", "mail-temporaire.fr", "mail.bthow.com",
  "mail.by", "mail.goo.ne.jp", "mail.mezimages.net", "mail.salu.net", "mail.zp.ua",
  "mail0.ga", "mail1.top", "mail1a.de", "mail2rss.org", "mail333.com", "mail3000.com",
  "mailbidon.com", "mailbucket.org", "mailc.net", "mailcat.biz", "mailcatch.com",
  "mailde.de", "mailde.info", "mailexpire.com", "mailf5.com", "mailfake.com", "mailfs.com",
  "mailguard.me", "mailhazard.com", "mailhazard.us", "mailimate.com",
  "mailin8r.com", "mailinater.com", "mailinator2.com", "mailinator2.net",
  "mailincubator.com", "mailismagic.com", "mailme.ir", "mailme.lv", "mailme24.com",
  "mailmetrash.com", "mailmoat.com", "mailnew.com", "mailnull.com", "mailpick.biz",
  "mailplushq.com", "mailproxsy.com", "mailquack.com", "mailrock.biz", "mailscrap.com",
  "mailseal.de", "mailsiphon.com", "mailslapping.com", "mailslite.com", "mailsnull.com",
  "mailspam.me", "mailspam.xyz", "mailstart.com", "mailsucker.net", "mailtothis.com",
  "mailtrash.net", "mailtv.net", "mailtv.tv", "mailueberfall.de", "mailwithyou.com",
  "mailzilla.org", "makemetheking.com", "malahov.de", "mbx.cc", "mega.zik.dj",
  "meinspamschutz.de", "meltmail.com", "messagebeamer.de", "mierdamail.com", "mintemail.com",
  "mmmmail.com", "moaktmail.net", "mohmal.com", "moncourrier.fr.nf", "monemail.fr.nf",
  "monmail.fr.nf", "mucinowski.com", "mt2009.com", "mt2014.com", "mt2015.com",
  "my10minutemail.com", "myemailboxy.com", "mynet.com.tr", "myphantomemail.com",
  "myspamless.com", "mytemp.email", "myz.info", "nada.email", "nada.ltd",
  "nakedtruth.biz", "nameplanet.com", "netzidiot.de", "newpapermail.com",
  "ng-mail.de", "nice2009.com", "nispam.com", "nlwakzxq.com", "no-spam.ws", "nobulk.com",
  "noclickemail.com", "nodezine.com", "nogmailspam.info", "nohboard.org", "nomail.pw",
  "nomail2me.com", "nomorespamemails.com", "nonspam.eu", "nonspammer.de", "noobies.online",
  "nospam.beats.org", "nospam.ze.tc", "nospam4.us", "nospamfor.us", "nospammail.net",
  "nospamthanks.info", "notmailinator.com", "notrnailinator.com", "notsharingmy.info",
  "nowhere.org", "nowmymail.com", "nowmymail.net", "nudgear.com", "nurfuerspam.de",
  "nwldx.com", "o2.co.uk", "objectmail.com", "obobbo.com", "okrent.us", "oneoffmail.com",
  "onewaymail.com", "onlatedotcom.info", "online.ms", "onqin.com", "opentrash.com",
  "oopi.org", "opticaldrive.com", "orbitalcell.com", "ordinaryamerican.net", "otherinbox.com",
  "ourklips.com", "outlawspam.com", "ovpn.to", "owlpic.com", "ozyl.de", "paplease.com",
  "pepbot.com", "perma.cc", "pimpedupmyspace.com", "pisosani.net", "pjjkp.com",
  "plexolan.de", "plexolan.net", "pmlep.de", "pookmail.com", "postacı.com",
  "posteriori.us", "pour-spam.com", "privacy-mail.top", "privatdemail.net", "proxymail.eu",
  "prtnx.com", "prtz.eu", "put2.net", "putthisinyourspamdatabase.com", "pwrby.com",
  "qq.com.mail-temp.com", "quickinbox.com", "quickmail.best", "quickmail.in",
  "r4nd0m.de", "ra3.us", "rabiot.realty", "radical-accelerationism.org", "rainmail.biz",
  "rcpt.at", "recode.me", "recursor.net", "recyclemail.dk", "regbypass.com",
  "regbypass.comsafe-mail.net", "rejo.technology", "reliable-mail.com", "remail.cf",
  "renraku.in", "rklips.com", "rmail.cl", "rn.com", "roll.fastlr.com", "ronnierage.net",
  "rotaniliam.com", "rppkn.com", "rtrtr.com", "ru.spamavert.com", "rudymail.ml",
  "s0ny.net", "safe-mail.net", "safetypost.de", "sandelf.de", "sanim.net",
  "sc.cntestherniaaffiliate.com", "schafmail.de", "schrott-email.de", "sd3.in",
  "selfdestructingmail.com", "sendspamhere.com", "sharklasers.com", "sharedmailbox.org",
  "shieldemail.com", "shiftmail.com", "shitmail.me", "shitmail.org", "shitware.nl",
  "shortmail.net", "sibmail.com", "simple-mail.de", "simpleitsecurity.info",
  "skeefmail.com", "skymailapp.com", "slapsfromlastnight.com", "slopsbox.com",
  "smellfear.com", "smwg.info", "snkmail.com", "snkmail.net", "sofimail.com",
  "sofort-mail.de", "softpls.asia", "sogetthis.com", "soisz.com", "solar-impact.pro",
  "solvemail.info", "spam4.me", "spamavert.com", "spambob.com", "spambob.net",
  "spambob.org", "spambog.com", "spambog.de", "spambog.ru", "spambox.info",
  "spambox.irishspringrealty.com", "spambox.us", "spamcannon.com", "spamcannon.net",
  "spamcero.com", "spamcon.org", "spamcorptastic.com", "spamcowboy.com", "spamcowboy.net",
  "spamcowboy.org", "spamday.com", "spamex.com", "spamfree24.biz", "spamfree24.de",
  "spamfree24.eu", "spamfree24.info", "spamfree24.net", "spamfree24.org", "spamgoes.in",
  "spamgourmet.com", "spamgourmet.net", "spamgourmet.org", "spamgrap.de", "spamhere.net",
  "spamhole.com", "spamify.com", "spaminator.de", "spamkill.info", "spaml.com",
  "spaml.de", "spammotel.com", "spammy.host", "spamoff.de", "spamsalad.in",
  "spamslicer.com", "spamspot.com", "spamstack.net", "spamthis.co.uk", "spamthisplease.com",
  "spamtroll.net", "spamwc.de", "spamwc.net", "spamwc.org", "speed.1s.fr", "spl0.com",
  "spoofmail.de", "squizzy.de", "squizzy.eu", "squizzy.net", "stinkefinger.net",
  "stuffmail.de", "suremail.info", "svk.jp", "sweetxxx.de", "taglead.com",
  "tagyourself.com", "tapchicuocsong.com", "tempalias.com", "tempe-mail.com",
  "tempemail.biz", "tempemail.co.za", "tempemail.com", "tempemail.net", "tempinbox.co.uk",
  "tempinbox.com", "tempmail.de", "tempmail.eu", "tempmail.in", "tempmail.info",
  "tempmail.net", "tempmail.org", "tempmail.us", "tempmail2.com", "tempomail.fr",
  "temporaryemail.net", "temporaryemail.us", "temporaryforwarding.com",
  "temporaryinbox.com", "temporarymail.pro", "thanksnospam.info", "thecloudindex.com",
  "thelimestones.com", "thex.ro", "theteastack.com", "thichanthang.net", "thisisnotmyrealemail.com",
  "throwam.com", "throwaway.email", "throwaymail.com", "tinoza.org", "tmail.com",
  "tmail.ws", "tmailinator.com", "toiea.com", "toomail.biz", "topranklist.de",
  "tradermail.info", "trash-amil.com", "trash-mail.at", "trash-mail.cf", "trash-mail.ga",
  "trash-mail.gq", "trash-mail.io", "trash-mail.ml", "trash-mail.tk", "trash2009.com",
  "trash2010.com", "trash2011.com", "trashdevil.com", "trashdevil.de", "trashemail.de",
  "trashimail.com", "trashmail.app", "trashmail.at", "trashmail.com", "trashmail.io",
  "trashmail.me", "trashmail.net", "trashmail.org", "trashmail.xyz", "trashmailer.com",
  "trashtr.com", "trubadouremail.com", "tsamail.co.za", "tspam.ga", "tspam.gq",
  "ttnmn.com", "turual.com", "twinmail.de", "tyldd.com", "uggsrock.com", "umail.net",
  "uroid.com", "usetempmail.com", "valemail.net", "valemail.com", "veryrealemail.com",
  "viditag.com", "vipxm.net", "viral.email", "vkcode.ru", "vpn.st", "vsimcard.com",
  "vubby.com", "walala.org", "walkmail.net", "walkmail.ru", "webemail.me", "webm4il.info",
  "webuser.in", "weemail.com", "weg-werf-email.de", "wegetmail.com", "wegwerf-email.at",
  "wegwerf-email.de", "wegwerf-email.net", "wegwerf-email.org", "wegwerfadresse.de",
  "wegwerfemail.de", "wegwerfemail.info", "wegwerfemail.net", "wegwerfemail.org",
  "wetrainbayarea.com", "wetrainbayarea.org", "whyspam.me", "wilemail.com",
  "willselfdestruct.com", "wmail.cf", "wollan.info", "wuzupmail.net", "www.e4ward.com",
  "www.gishpuppy.com", "www.mailinator.com", "wwwnew.eu", "x.ip6.li", "xagloo.co",
  "xagloo.com", "xemaps.com", "xents.com", "xmaily.com", "xoxy.net", "xwolf.de",
  "xyzfree.net", "yanet.me", "yapped.net", "yeah.net", "yep.it", "yogamaven.com",
  "yopmail.com", "yopmail.fr", "yopmail.gq", "you-spam.com", "yourdomain.com",
  "yppm.com", "yroid.com", "yuurok.com", "z0d.eu", "zehnminutenmail.de",
  "zippymail.info", "zoaxe.com", "zoemail.com", "zoemail.net", "zoemail.org",
  "zomg.info", "zxcv.com", "zxcvbnm.com", "zzz.com",
]);

export function getDisposableEmailError(email: string): string | null {
  const lower = email.trim().toLowerCase();
  const atIdx = lower.lastIndexOf("@");
  if (atIdx === -1) return "Please enter a valid email address.";
  const domain = lower.slice(atIdx + 1);

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return "Please use a real email address. Temporary or disposable emails are not allowed.";
  }

  const localPart = lower.slice(0, atIdx);

  // Basic length check
  if (localPart.length < 3) return "Please enter a valid email address.";

  // Block pure numbers
  const isAllNumbers = /^\d+$/.test(localPart);
  if (isAllNumbers) return "Please use a real email address.";

  // Check for vowels - real emails usually have at least one
  const hasVowel = /[aeiou]/.test(localPart);
  if (localPart.length <= 4 && !hasVowel) {
    return "Please use a real email address — this one looks invalid.";
  }

  // Detect keyboard mashing patterns (e.g., asdfasdf, qwertyui, jkjkjk)
  // 1. Check for repeating character pairs/sequences
  const hasRepeatingPairs = /(.{2,})\1{1,}/.test(localPart); // e.g., asdfasdf (2+ repeats)
  if (hasRepeatingPairs && localPart.length >= 8) {
    return "Please use a real email address — this doesn't look like a valid email.";
  }

  // 2. Detect keyboard rows (qwerty, asdf, zxcv patterns)
  const keyboardRows = [
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
    'poiuytrewq', 'lkjhgfdsa', 'mnbvcxz'
  ];

  for (const row of keyboardRows) {
    // Check if localPart contains 5+ consecutive keyboard row chars
    for (let i = 0; i <= row.length - 5; i++) {
      const sequence = row.substring(i, i + 5);
      if (localPart.includes(sequence)) {
        return "Please use a real email address — keyboard patterns are not allowed.";
      }
    }
  }

  // 3. Check for excessive character repetition (e.g., aaaaaaa, 11111)
  const hasExcessiveRepetition = /(.)\1{4,}/.test(localPart); // 5+ same chars in a row
  if (hasExcessiveRepetition) {
    return "Please use a real email address — this doesn't look valid.";
  }

  // 4. Check consonant-to-vowel ratio (real names/words have balanced ratios)
  const vowels = (localPart.match(/[aeiou]/g) || []).length;
  const consonants = (localPart.match(/[bcdfghjklmnpqrstvwxyz]/g) || []).length;

  // If there are 8+ chars and NO vowels at all, likely fake
  if (localPart.length >= 8 && vowels === 0) {
    return "Please use a real email address — this doesn't look like a valid email.";
  }

  // 5. Check for extremely low vowel ratio (less than 15% vowels is suspicious)
  if (localPart.length >= 8) {
    const totalLetters = vowels + consonants;
    if (totalLetters > 0 && (vowels / totalLetters) < 0.15) {
      return "Please use a real email address — this doesn't look valid.";
    }
  }

  // 6. Detect alternating key patterns (ababab, 121212, xoxoxo)
  const hasAlternating = /^(.)(.)(\1\2){2,}/.test(localPart); // e.g., ababab
  if (hasAlternating) {
    return "Please use a real email address — this pattern looks suspicious.";
  }

  return null;
}

const ROLE_CACHE_KEY = "pulsechat_role";
const ROLE_CACHE_UID_KEY = "pulsechat_role_uid";

function getCachedRole(userId: string): Role | null {
  try {
    const uid = localStorage.getItem(ROLE_CACHE_UID_KEY);
    const cached = localStorage.getItem(ROLE_CACHE_KEY);
    if (uid === userId && (cached === "admin" || cached === "user")) return cached as Role;
  } catch { /* ignore */ }
  return null;
}

function setCachedRole(userId: string, role: Role) {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, role);
    localStorage.setItem(ROLE_CACHE_UID_KEY, userId);
  } catch { /* ignore */ }
}

function clearCachedRole() {
  try {
    localStorage.removeItem(ROLE_CACHE_KEY);
    localStorage.removeItem(ROLE_CACHE_UID_KEY);
  } catch { /* ignore */ }
}

// Fetch role with a hard 4-second timeout so loading never hangs forever
async function fetchRole(userId: string): Promise<Role> {
  // Return cached role immediately if available
  const cached = getCachedRole(userId);

  const fetchPromise = supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .then(({ data, error }) => {
      if (error || !data) return cached ?? ("user" as Role);
      const isAdmin = data.some((r) => r.role === "admin");
      const resolved: Role = isAdmin ? "admin" : "user";
      setCachedRole(userId, resolved);
      return resolved;
    })
    .catch(() => cached ?? ("user" as Role));

  // Hard 4s timeout — never block the UI longer than this
  const timeoutPromise = new Promise<Role>((resolve) =>
    setTimeout(() => resolve(cached ?? "user"), 4000)
  );

  return Promise.race([fetchPromise, timeoutPromise]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Bootstrap: get existing session once, resolve role, then set loading=false
    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      if (!mounted) return;

      setSession(existing);
      setUser(existing?.user ?? null);

      if (existing?.user) {
        // Apply cached role instantly so UI doesn't wait
        const cached = getCachedRole(existing.user.id);
        if (cached) setRole(cached);

        // Fetch fresh role (with timeout)
        const resolved = await fetchRole(existing.user.id);
        if (mounted) setRole(resolved);
      }

      if (mounted) setLoading(false);
    }).catch(() => {
      // getSession itself failed — unblock the UI
      if (mounted) setLoading(false);
    });

    // Listen for auth changes (sign in / sign out / token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Apply cached role instantly to avoid a null-role flash
        const cached = getCachedRole(newSession.user.id);
        if (cached) {
          setRole(cached);
          // Already have a cached role — unblock loading now, role will silently refresh
          if (mounted) setLoading(false);
        }

        // Fetch fresh role (with timeout), then clear loading if not already cleared
        const resolved = await fetchRole(newSession.user.id);
        if (mounted) {
          setRole(resolved);
          setLoading(false); // no-op if already false
        }
      } else {
        setRole(null);
        clearCachedRole();
        // Signed out — unblock immediately
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, displayName: string) {
    // Block disposable / throwaway email domains
    const disposableError = getDisposableEmailError(email);
    if (disposableError) return { error: disposableError };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { display_name: displayName },
      },
    });

    if (data?.user && !data.session) {
      return {
        error: null,
        message: "Please check your email to confirm your account before signing in.",
      };
    }

    return { error: error?.message ?? null };
  }

  async function signOut() {
    clearCachedRole();
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
