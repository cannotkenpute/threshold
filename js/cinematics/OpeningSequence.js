/**
 * 1980s Retro Psychological Horror Opening Sequence
 * Complete Blackout -> Title Card -> Classified Document Montage -> Final Authorization -> Level 1 Cut
 */

export class OpeningSequence {
  constructor(renderer, audio, state, onComplete) {
    this.renderer = renderer;
    this.audio = audio;
    this.state = state;
    this.onComplete = onComplete;

    this.container = null;
    this.isActive = false;
    this.isSkipped = false;
    this.timeouts = [];
    this.currentDrone = null;
    this.overlappingAudioElements = [];

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    let el = document.getElementById('opening-sequence-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'opening-sequence-overlay';
      el.className = 'opening-overlay';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    this.container = el;
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.isActive && (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        this.skip();
      }
    });
  }

  schedule(fn, delayMs) {
    const id = setTimeout(() => {
      if (this.isActive && !this.isSkipped) {
        fn();
      }
    }, delayMs);
    this.timeouts.push(id);
    return id;
  }

  start() {
    this.isActive = true;
    this.isSkipped = false;
    this.timeouts = [];
    this.overlappingAudioElements = [];

    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'flex';
      this.container.className = 'opening-overlay phase-blackout';
    }

    // 1. BLACK SCREEN (Complete silence for 1s)
    // 2. T=1.0s: Electrical hum fades in
    this.schedule(() => {
      this.currentDrone = this.audio.startOpeningDrone();
    }, 1000);

    // 3. T=2.2s: Title Card "CANNOTKENPUTE PRESENTS"
    this.schedule(() => {
      this.renderTitleCard();
    }, 2200);

    // 4. T=6.0s: VHS Static Burst & Title Vanishes
    this.schedule(() => {
      this.triggerStaticGlitch();
    }, 6000);

    // 5. T=7.2s: Document 01 - Department Header & Classified Stamp
    this.schedule(() => {
      this.renderDocument01();
    }, 7200);

    // 6. T=10.0s: Document 02 - Internal Memorandum + Vaughn Voice 1
    this.schedule(() => {
      this.renderDocument02();
    }, 10000);

    // 7. T=13.0s: Document 03 - Expedition 04 Personnel Status + Overlapping Radio
    this.schedule(() => {
      this.renderDocument03();
    }, 13000);

    // 8. T=15.8s: Newspaper Clipping 1 - Night Activity at Federal Facility
    this.schedule(() => {
      this.renderNewspaper01();
    }, 15800);

    // 9. T=18.0s: Document 04 - Safety Bulletin (Tether Directive)
    this.schedule(() => {
      this.renderDocument04();
    }, 18000);

    // 10. T=20.8s: Document 05 - Incident Report ("Something Behind Us")
    this.schedule(() => {
      this.renderDocument05();
    }, 20800);

    // 11. T=23.2s: Polaroid Photograph (Corridor 6 with circled figure)
    this.schedule(() => {
      this.renderPolaroidPhoto();
    }, 23200);

    // 12. T=25.5s: Rapid Climax Montage (Docs 06 & 07, Missing Clipping, Strobe Alerts, Overlapping Voices)
    this.schedule(() => {
      this.renderMontageClimax();
    }, 25500);

    // 13. T=29.2s: Total Blackout & Stop Everything (Only Tape Hiss)
    this.schedule(() => {
      this.renderBlackoutSilence();
    }, 29200);

    // 14. T=30.6s: Final Expedition Authorization Document
    this.schedule(() => {
      this.renderExpeditionAuthorization();
    }, 30600);

    // 15. T=34.0s: Final Clear Transmission "Proceed."
    this.schedule(() => {
      this.renderFinalTransmission();
    }, 34000);

    // 16. T=36.0s: Cut to Gameplay!
    this.schedule(() => {
      this.finish();
    }, 36000);
  }

  renderSkipHint() {
    const hint = document.createElement('div');
    hint.className = 'opening-skip-hint';
    hint.innerHTML = '<span>[SPACE / ESC] SKIP BRIEFING</span>';
    hint.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });
    this.container.appendChild(hint);
  }

  // --- PHASE 1: TITLE CARD ---
  renderTitleCard() {
    this.container.innerHTML = '';
    this.renderSkipHint();

    const titleWrap = document.createElement('div');
    titleWrap.className = 'opening-title-wrap crt-text-flicker';
    titleWrap.innerHTML = `
      <div class="opening-presents-text">CANNOTKENPUTE PRESENTS</div>
    `;
    this.container.appendChild(titleWrap);
  }

  // --- PHASE 2: STATIC BURST & TRANSITION ---
  triggerStaticGlitch() {
    this.audio.playVHSGlitchBurst(0.45);
    if (this.renderer && this.renderer.setVHSGlitch) {
      this.renderer.setVHSGlitch(2.8);
      setTimeout(() => {
        if (this.renderer) this.renderer.setVHSGlitch(0.0);
      }, 400);
    }
    const staticOverlay = document.createElement('div');
    staticOverlay.className = 'opening-static-flash';
    this.container.appendChild(staticOverlay);
    setTimeout(() => {
      if (staticOverlay.parentNode) staticOverlay.parentNode.removeChild(staticOverlay);
    }, 350);

    // Remove title
    const title = this.container.querySelector('.opening-title-wrap');
    if (title) title.remove();

    // Prepare Document Stage
    let stage = this.container.querySelector('#opening-doc-stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.id = 'opening-doc-stage';
      stage.className = 'opening-doc-stage';
      this.container.appendChild(stage);
    }
  }

  // --- DOCUMENT 01: DEPARTMENT HEADER ---
  renderDocument01() {
    const stage = document.getElementById('opening-doc-stage') || this.container;
    this.audio.playPaperSlamSound();

    const doc = document.createElement('div');
    doc.className = 'opening-doc doc-01 doc-slide-in';
    doc.style.transform = `translate(-50%, -50%) rotate(${(Math.random() * 2 - 1).toFixed(1)}deg)`;
    doc.innerHTML = `
      <img src="./assets/textures/department_seal_transparent.png" class="doc-seal-emblem seal-top-right" alt="Department of Spatial Anomaly Seal" />
      <img src="./assets/textures/department_seal_transparent.png" class="doc-watermark" alt="Seal Watermark" />
      <div class="doc-header-block">
        <div class="doc-gov-title">UNITED STATES DEPARTMENT OF SPATIAL ANOMALY</div>
        <div class="doc-gov-sub">OFFICE OF EXTRADIMENSIONAL RESEARCH</div>
        <div class="doc-security-level">TOP SECRET // COMPARTMENTALIZED</div>
      </div>
      <div class="doc-meta-row">
        <span><strong>PROJECT DESIGNATION:</strong> THRESHOLD</span>
        <span><strong>DATE:</strong> 11 OCTOBER 1987</span>
      </div>
      <div class="doc-meta-row">
        <span><strong>FACILITY:</strong> <span class="doc-redacted">█████████████</span></span>
      </div>
      <div class="doc-body-text">
        <p>On 08 October 1987, Research Division personnel confirmed the existence of a spatial environment occupying no measurable position relative to conventional geographic coordinates.</p>
        <p>Preliminary measurements indicate that the accessible interior exceeds the physical dimensions of the entry site by several orders of magnitude.</p>
        <p>The origin and total extent of the environment remain unknown.</p>
      </div>
      <div class="doc-stamp stamp-classified">CLASSIFIED</div>
    `;
    stage.appendChild(doc);

    // Slam Classified Stamp audio
    this.schedule(() => {
      this.audio.playStampThudSound();
      const stamp = doc.querySelector('.stamp-classified');
      if (stamp) stamp.classList.add('stamp-impact');
    }, 900);
  }

  // --- DOCUMENT 02: INTERNAL MEMORANDUM ---
  renderDocument02() {
    const stage = document.getElementById('opening-doc-stage') || this.container;
    this.audio.playPaperSlamSound();

    const doc = document.createElement('div');
    doc.className = 'opening-doc doc-02 doc-slide-in';
    doc.style.transform = `translate(-48%, -47%) rotate(${(Math.random() * 3 - 1.5).toFixed(1)}deg)`;
    doc.innerHTML = `
      <img src="./assets/textures/department_seal_transparent.png" class="doc-seal-emblem seal-top-right" alt="Department Seal" />
      <div class="doc-header-block">
        <div class="doc-memo-title">MEMORANDUM</div>
      </div>
      <div class="doc-meta-row">
        <span><strong>TO:</strong> Director <span class="doc-redacted">█████████</span></span>
        <span><strong>FROM:</strong> Spatial Survey Division</span>
      </div>
      <div class="doc-meta-row">
        <span><strong>SUBJECT:</strong> PERMANENT ACCESS PROGRAM</span>
      </div>
      <div class="doc-body-text">
        <p>Initial exploration teams have demonstrated that prolonged human occupation of the anomalous environment is possible.</p>
        <p>Construction crews are authorized to begin establishment of permanent research infrastructure beyond Threshold Point A.</p>
        <p>Personnel assigned to the project are reminded that the existence of the site is classified under Executive Directive <span class="doc-redacted">███-██</span>.</p>
        <p>Unauthorized disclosure will constitute a threat to national security.</p>
      </div>
      <div class="doc-handwritten">“Vaughn wants Phase II operational before January.”</div>
    `;
    stage.appendChild(doc);

    // Voice 1: Vaughn
    this.schedule(() => {
      this.playVaughnTrack('v1.mp3', "Your assignment is straightforward—");
    }, 600);
  }

  // --- DOCUMENT 03: PERSONNEL STATUS ---
  renderDocument03() {
    const stage = document.getElementById('opening-doc-stage') || this.container;
    this.audio.playPaperSlamSound();

    const doc = document.createElement('div');
    doc.className = 'opening-doc doc-03 doc-slide-in';
    doc.style.transform = `translate(-52%, -51%) rotate(${(Math.random() * 4 - 2).toFixed(1)}deg)`;
    doc.innerHTML = `
      <img src="./assets/textures/department_seal_transparent.png" class="doc-seal-emblem seal-top-right" alt="Department Seal" />
      <div class="doc-header-block">
        <div class="doc-gov-title">EXPEDITION TEAM 04</div>
        <div class="doc-status-alert">MISSION STATUS: OVERDUE</div>
      </div>
      <table class="doc-table">
        <thead>
          <tr><th>PERSONNEL</th><th>ASSIGNMENT</th><th>STATUS</th></tr>
        </thead>
        <tbody>
          <tr><td>DR. <span class="doc-redacted">█████████</span></td><td>LEAD RESEARCHER</td><td class="status-missing">MISSING</td></tr>
          <tr><td>DR. <span class="doc-redacted">█████████</span></td><td>BIOLOGICAL SURVEY</td><td class="status-missing">MISSING</td></tr>
          <tr><td><span class="doc-redacted">████████████</span></td><td>SECURITY</td><td class="status-missing">MISSING</td></tr>
          <tr><td><span class="doc-redacted">████████████</span></td><td>ENGINEERING</td><td class="status-missing">MISSING</td></tr>
          <tr><td><span class="doc-redacted">████████████</span></td><td>COMMUNICATIONS</td><td class="status-missing">MISSING</td></tr>
        </tbody>
      </table>
      <div class="doc-meta-row" style="margin-top: 10px;">
        <span style="color: #8b1818; font-weight: bold;">LAST CONFIRMED RADIO CONTACT: 02:17</span>
      </div>
    `;
    stage.appendChild(doc);

    // Overlapping Vaughn voices (v2.mp3 and v3.mp3)
    this.schedule(() => {
      this.playVaughnTrack('v2.mp3', "—we lost contact at 02:17—");
    }, 400);
    this.schedule(() => {
      this.playVaughnTrack('v3.mp3', "Do not deviate from the marked route.");
    }, 1400);
  }

  // --- NEWSPAPER CLIPPING 01 ---
  renderNewspaper01() {
    const stage = document.getElementById('opening-doc-stage') || this.container;
    this.audio.playPaperSlamSound();

    const news = document.createElement('div');
    news.className = 'opening-news news-01 doc-slide-in';
    news.style.transform = `translate(-38%, -44%) rotate(3.2deg)`;
    news.innerHTML = `
      <div class="news-header">THE COUNTY CHRONICLE — NOV 1987</div>
      <h3 class="news-headline">LOCAL WORKERS QUESTION NIGHT ACTIVITY AT FEDERAL FACILITY</h3>
      <p class="news-body">Residents near <span class="doc-redacted">█████████</span> County have reported military trucks and construction equipment entering a supposedly inactive federal research property after midnight.</p>
      <p class="news-body">Officials declined to comment.</p>
      <p class="news-body">One resident reported hearing what they described as <em>“industrial machinery running underground.”</em></p>
      <div class="news-cut-edge"></div>
    `;
    stage.appendChild(news);
  }

  // --- DOCUMENT 04: SAFETY BULLETIN ---
  renderDocument04() {
    const stage = document.getElementById('opening-doc-stage') || this.container;
    this.audio.playPaperSlamSound();

    const doc = document.createElement('div');
    doc.className = 'opening-doc doc-04 doc-slide-in';
    doc.style.transform = `translate(-50%, -49%) rotate(-1.8deg)`;
    doc.innerHTML = `
      <img src="./assets/textures/department_seal_transparent.png" class="doc-seal-emblem seal-top-right" alt="Department Seal" />
      <div class="doc-header-block">
        <div class="doc-gov-title" style="color: #9a1818;">THRESHOLD ENTRY PROCEDURE</div>
        <div class="doc-security-level">MANDATORY SAFETY DIRECTIVE</div>
      </div>
      <div class="doc-body-text" style="font-weight: bold; line-height: 1.6;">
        <p>ALL PERSONNEL ENTERING THE ANOMALOUS ENVIRONMENT MUST REMAIN PHYSICALLY CONNECTED TO THE PRIMARY RETRIEVAL LINE.</p>
        <p style="color: #9a1818; font-size: 1.1rem; text-decoration: underline;">UNDER NO CIRCUMSTANCES SHOULD THE TETHER BE REMOVED.</p>
        <p>IN THE EVENT OF COMMUNICATION FAILURE:</p>
        <p style="letter-spacing: 1px;">FOLLOW THE TETHER BACK TO THRESHOLD POINT A.</p>
      </div>
    `;
    stage.appendChild(doc);

    // Overlapping Vaughn voices (v4.mp3 and v5.mp3)
    this.schedule(() => {
      this.playVaughnTrack('v4.mp3', "The tether is your only way back.");
    }, 400);
    this.schedule(() => {
      this.playVaughnTrack('v5.mp3', "—you are not authorized to investigate—");
    }, 1500);
  }

  // --- DOCUMENT 05: INCIDENT REPORT ---
  renderDocument05() {
    const stage = document.getElementById('opening-doc-stage') || this.container;
    this.audio.playPaperSlamSound();

    const doc = document.createElement('div');
    doc.className = 'opening-doc doc-05 doc-slide-in';
    doc.style.transform = `translate(-46%, -53%) rotate(2.4deg)`;
    doc.innerHTML = `
      <div class="doc-header-block">
        <div class="doc-memo-title" style="color: #8b1818;">INCIDENT REPORT — LEVEL 0</div>
      </div>
      <div class="doc-body-text">
        <p>SUBJECT exhibited severe confusion following retrieval.</p>
        <p>Subject repeatedly claimed that the corridors had <span class="doc-redacted">█████████████████████</span>.</p>
        <p>Subject was unable to identify members of the recovery team.</p>
        <p>At approximately 04:31, subject began repeating:</p>
        <p style="font-size: 1.25rem; font-weight: bold; color: #111; letter-spacing: 1px; margin: 10px 0;">“THERE WAS SOMETHING BEHIND US.”</p>
        <p>Further interviews suspended by order of <span class="doc-redacted">█████████</span>.</p>
      </div>
      <div class="doc-stamp stamp-red stamp-impact" style="bottom: 15px; right: 20px;">DO NOT DISTRIBUTE</div>
    `;
    stage.appendChild(doc);
    this.audio.playStampThudSound();
  }

  // --- POLAROID PHOTOGRAPH ---
  renderPolaroidPhoto() {
    const stage = document.getElementById('opening-doc-stage') || this.container;
    this.audio.playPaperSlamSound();

    const photo = document.createElement('div');
    photo.className = 'opening-polaroid doc-slide-in';
    photo.style.transform = `translate(-52%, -46%) rotate(-4deg)`;
    photo.innerHTML = `
      <div class="polaroid-frame">
        <div class="polaroid-image-layer">
          <div class="polaroid-corridor-art">
            <div class="corridor-light-glare"></div>
            <div class="corridor-hallway-perspective"></div>
            <div class="circled-entity-silhouette">
              <div class="red-circle-marker"></div>
            </div>
          </div>
          <div class="polaroid-scanlines"></div>
        </div>
        <div class="polaroid-caption">SURVEY CORRIDOR 6 — 03/14/88</div>
      </div>
    `;
    stage.appendChild(photo);
  }

  // --- MONTAGE CLIMAX (ACCELERATION & STROBE) ---
  renderMontageClimax() {
    const stage = document.getElementById('opening-doc-stage') || this.container;

    // Doc 06: Construction Authorization
    this.schedule(() => {
      this.audio.playPaperSlamSound();
      const doc6 = document.createElement('div');
      doc6.className = 'opening-doc doc-06 doc-slide-in';
      doc6.style.transform = `translate(-45%, -48%) rotate(1.2deg)`;
      doc6.innerHTML = `
        <img src="./assets/textures/department_seal_transparent.png" class="doc-seal-emblem seal-top-right" alt="Department Seal" />
        <div class="doc-header-block">
          <div class="doc-gov-title">PROJECT THRESHOLD — PHASE III</div>
          <div class="doc-security-level">AUTHORIZED INFRASTRUCTURE</div>
        </div>
        <div class="doc-body-text" style="font-size: 0.85rem; columns: 2;">
          <div>• Research laboratories</div>
          <div>• Personnel housing</div>
          <div>• Medical facilities</div>
          <div>• Power generation</div>
          <div>• Water reclamation</div>
          <div>• Communications relay</div>
          <div>• Security offices</div>
          <div>• Long-term storage</div>
          <div>• Civilian holding <span class="doc-redacted">████</span></div>
          <div>• <span class="doc-redacted">██████████████</span></div>
        </div>
        <div class="doc-meta-row" style="margin-top: 6px;">
          <span><strong>PROJECTED PERMANENT POPULATION:</strong> 312</span>
        </div>
        <div class="doc-handwritten" style="font-size: 0.95rem;">“If we're staying there permanently, stop calling it an outpost.”</div>
      `;
      stage.appendChild(doc6);
    }, 0);

    // Missing Persons Newspaper Clipping
    this.schedule(() => {
      this.audio.playPaperSlamSound();
      const news2 = document.createElement('div');
      news2.className = 'opening-news news-02 doc-slide-in';
      news2.style.transform = `translate(-55%, -42%) rotate(-5deg)`;
      news2.innerHTML = `
        <div class="news-header">TRI-COUNTY GAZETTE</div>
        <h4 class="news-headline" style="font-size: 1.05rem;">SEVEN PEOPLE REPORTED MISSING ACROSS THREE COUNTIES</h4>
        <p class="news-body" style="font-size: 0.82rem;">Authorities say there is currently no evidence connecting the disappearances. Federal officials have denied involvement.</p>
        <p class="news-body" style="font-weight: bold; font-size: 0.85rem;">“…several families claim they were approached by government representatives shortly before the disappearances.”</p>
      `;
      stage.appendChild(news2);
    }, 450);

    // Doc 07: Human Research Authorization
    this.schedule(() => {
      this.audio.playPaperSlamSound();
      const doc7 = document.createElement('div');
      doc7.className = 'opening-doc doc-07 doc-slide-in';
      doc7.style.transform = `translate(-49%, -50%) rotate(3.5deg)`;
      doc7.innerHTML = `
        <img src="./assets/textures/department_seal_transparent.png" class="doc-seal-emblem seal-top-right" alt="Department Seal" />
        <div class="doc-header-block">
          <div class="doc-gov-title" style="color: #a00;">SPECIAL ACCESS REQUIRED</div>
          <div class="doc-security-level">SUBJECT PROCUREMENT PROGRAM</div>
        </div>
        <div class="doc-body-text" style="font-size: 0.88rem;">
          <p>…civilian subjects…</p>
          <p>…no immediate family contact…</p>
          <p>…exposure duration increased to <span class="doc-redacted">███</span> hours…</p>
          <p>…psychological deterioration considered acceptable…</p>
          <p>…results justify continuation…</p>
        </div>
        <div class="doc-handwritten" style="color: #8b1818; font-size: 1.15rem; font-weight: bold;">“V. APPROVED.”</div>
      `;
      stage.appendChild(doc7);
    }, 900);

    // Overlapping Chorus of Vaughn Transmission Voices (v1 to v7)
    const clips = [
      { file: 'v1.mp3', text: "Your assignment is straightforward—" },
      { file: 'v2.mp3', text: "—we lost contact at 02:17—" },
      { file: 'v3.mp3', text: "Do not deviate from the marked route." },
      { file: 'v4.mp3', text: "The tether is your only way back." },
      { file: 'v5.mp3', text: "—you are not authorized to investigate—" },
      { file: 'v6.mp3', text: "If you encounter anything unusual—" },
      { file: 'v7.mp3', text: "—come back immediately." }
    ];
    clips.forEach((clip, idx) => {
      this.schedule(() => {
        this.playVaughnTrack(clip.file, clip.text);
      }, 300 + idx * 250);
    });

    // Rapid Flash Strobe Alerts
    const alerts = [
      "LEVEL ██ EVACUATION",
      "CONTACT LOST",
      "DO NOT ATTEMPT RECOVERY",
      "████ PERSONNEL UNACCOUNTED FOR",
      "THRESHOLD FAILURE",
      "FACILITY LOCKDOWN",
      "ORDER FROM SUPERVISOR VAUGHN"
    ];
    alerts.forEach((alertText, idx) => {
      this.schedule(() => {
        this.renderStrobeAlert(alertText);
      }, 1600 + idx * 160);
    });
  }

  renderStrobeAlert(text) {
    this.audio.playStampThudSound();
    if (this.renderer && this.renderer.setVHSGlitch) {
      this.renderer.setVHSGlitch(1.8);
      setTimeout(() => {
        if (this.renderer) this.renderer.setVHSGlitch(0);
      }, 120);
    }
    const strobe = document.createElement('div');
    strobe.className = 'opening-strobe-card';
    strobe.innerHTML = `<span>${text}</span>`;
    this.container.appendChild(strobe);
    setTimeout(() => {
      if (strobe.parentNode) strobe.parentNode.removeChild(strobe);
    }, 150);
  }

  // --- PHASE 3: SILENCE & FINAL EXPEDITION AUTHORIZATION ---
  renderBlackoutSilence() {
    // Cut all ambient drones, speech, and sound abruptly
    this.audio.stopOpeningDrone(0.05);
    this.audio.stopAllVoiceTracks();
    this.overlappingAudioElements.forEach(el => {
      try { el.pause(); } catch(e){}
    });
    this.overlappingAudioElements = [];

    // Clear stage to pure black
    this.container.innerHTML = '';
    this.renderSkipHint();
  }

  renderExpeditionAuthorization() {
    this.audio.playPaperSlamSound();
    const doc = document.createElement('div');
    doc.className = 'opening-doc doc-final doc-fade-in';
    doc.style.transform = `translate(-50%, -50%)`;
    doc.innerHTML = `
      <img src="./assets/textures/department_seal_transparent.png" class="doc-seal-emblem seal-auth-header" alt="Official Seal" />
      <img src="./assets/textures/department_seal_transparent.png" class="doc-watermark" alt="Watermark" />
      <div class="doc-header-block" style="border-bottom: 2px solid #1a1a18; padding-bottom: 8px;">
        <div class="doc-gov-title" style="font-size: 1.15rem;">UNITED STATES DEPARTMENT OF SPATIAL ANOMALY</div>
        <div class="doc-security-level" style="font-size: 0.95rem; margin-top: 4px; color: #111;">RECOVERY MISSION AUTHORIZATION</div>
      </div>
      <div class="doc-meta-grid" style="margin: 18px 0; font-size: 0.92rem; line-height: 1.8;">
        <div><strong>OBJECTIVE:</strong> LOCATE EXPEDITION TEAM 04</div>
        <div><strong>PRIMARY RESEARCHER:</strong> <span style="color: #8b1818; font-weight: bold;">MISSING</span></div>
        <div><strong>REPLACEMENT RESEARCHER:</strong> <span class="doc-redacted">████████████████</span></div>
        <div><strong>SUPERVISOR:</strong> VAUGHN</div>
        <div><strong>ENTRY POINT:</strong> THRESHOLD A</div>
        <div><strong>RETRIEVAL METHOD:</strong> PHYSICAL TETHER</div>
      </div>
      <div class="doc-stamp stamp-green stamp-impact" style="position: relative; margin-top: 15px; text-align: center; border-width: 3px; font-size: 1.3rem;">
        MISSION AUTHORIZED
      </div>
    `;
    this.container.appendChild(doc);
    this.audio.playStampThudSound();
  }

  renderFinalTransmission() {
    // Fade out authorization document to pure black
    const doc = this.container.querySelector('.doc-final');
    if (doc) {
      doc.style.transition = 'opacity 1.2s ease';
      doc.style.opacity = '0';
    }

    // Vaughn says "Proceed." (v8.mp3) with pristine clarity
    this.schedule(() => {
      this.playVaughnTrack('v8.mp3', "Proceed.", {
        rate: 0.9,
        pitch: 0.75,
        volume: 1.0,
        onEnd: () => {
          setTimeout(() => {
            this.finish();
          }, 600);
        }
      });

      // Subtitle overlay
      const subtitle = document.createElement('div');
      subtitle.className = 'opening-final-subtitle';
      subtitle.innerHTML = `<strong>VAUGHN:</strong> “Proceed.”`;
      this.container.appendChild(subtitle);
    }, 1200);
  }

  playVaughnTrack(filename, fallbackText, options = {}) {
    if (this.audio && this.audio.playVoiceTrack) {
      this.audio.playVoiceTrack(filename, fallbackText, options);
    } else if (this.audio && this.audio.speakRadioVoice) {
      this.audio.speakRadioVoice(fallbackText, options);
    }
  }

  skip() {
    if (this.isSkipped) return;
    this.isSkipped = true;
    this.finish();
  }

  finish() {
    this.isActive = false;
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts = [];

    this.audio.stopOpeningDrone(0.2);
    this.audio.stopAllVoiceTracks();
    this.overlappingAudioElements.forEach(el => {
      try { el.pause(); } catch(e){}
    });
    this.overlappingAudioElements = [];

    if (this.container) {
      this.container.style.display = 'none';
      this.container.innerHTML = '';
    }

    if (this.onComplete) {
      this.onComplete();
    }
  }
}
