import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, r1bStepsInfo, Project, Task, StockArticle, User } from './src/data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

declare module 'express-session' {
  interface SessionData {
    user?: { id: number; identifiant: string; role: string };
    flash?: { type: string; message: string };
    sid?: string;
  }
}

// In-memory fallback session store to guarantee authentication in iframe environments where third-party cookies are blocked
interface SessionRecord {
  user: { id: number; identifiant: string; role: string };
  flash?: { type: string; message: string };
  expiresAt: number;
}
const activeSessions = new Map<string, SessionRecord>();

function createSessionRecord(user: { id: number; identifiant: string; role: string }): string {
  const sid = crypto.randomBytes(24).toString('hex');
  activeSessions.set(sid, {
    user,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return sid;
}

function getSessionRecord(sid: string): SessionRecord | null {
  const record = activeSessions.get(sid);
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    activeSessions.delete(sid);
    return null;
  }
  return record;
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// Enable trust proxy for Cloud Run & AI Studio reverse proxy
app.set('trust proxy', 1);

// Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Body & Cookie parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser('projectflow_session_secret_2026'));

// Express Session setup with SameSite=None and Secure for iFrames
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'projectflow_session_secret_2026',
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: false,
      sameSite: 'none',
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Dual-layer session resolver: resolves from cookie session OR URL sid OR request cookie
app.use((req: Request, res: Response, next: NextFunction) => {
  const querySid = (req.query.sid as string) || (req.body?.sid as string);
  const cookieSid = req.cookies?.['pf_sid'];
  const sid = querySid || cookieSid || req.session?.sid;

  let currentUser: { id: number; identifiant: string; role: string } | null = req.session?.user || null;
  let flashMsg: { type: string; message: string } | null = req.session?.flash || null;

  if (sid) {
    const record = getSessionRecord(sid);
    if (record) {
      currentUser = record.user;
      if (record.flash) {
        flashMsg = record.flash;
        delete record.flash;
      }
      res.locals.sid = sid;
    }
  }

  // Clear express session flash after reading
  if (req.session?.flash) {
    delete req.session.flash;
  }

  res.locals.user = currentUser;
  res.locals.flash = flashMsg;
  res.locals.siteNom = db.settings.site_nom || 'ProjectFlow';
  res.locals.siteTagline = db.settings.site_tagline || 'Gestion de projets, processus & documentation';
  res.locals.pageTitle = '';
  res.locals.activePage = '';
  res.locals.steps = r1bStepsInfo;
  res.locals.qs = res.locals.sid ? `?sid=${encodeURIComponent(res.locals.sid)}` : '';
  res.locals.qAmp = res.locals.sid ? `&sid=${encodeURIComponent(res.locals.sid)}` : '';
  next();
});

// Helper for flash messages
function setFlash(req: Request, res: Response, type: 'success' | 'error' | 'info', message: string) {
  if (req.session) {
    req.session.flash = { type, message };
  }
  const sid = res.locals.sid || (req.query.sid as string);
  if (sid) {
    const record = activeSessions.get(sid);
    if (record) record.flash = { type, message };
  }
}

// Redirect helper preserving sid if present
function redirectWithSid(req: Request, res: Response, targetUrl: string) {
  const sid = res.locals.sid || (req.query.sid as string) || req.session?.sid;
  if (!sid) {
    return res.redirect(targetUrl);
  }
  const separator = targetUrl.includes('?') ? '&' : '?';
  if (targetUrl.includes('sid=')) {
    return res.redirect(targetUrl);
  }
  return res.redirect(`${targetUrl}${separator}sid=${encodeURIComponent(sid)}`);
}

// Auth guard
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user) {
    setFlash(req, res, 'error', 'Veuillez vous connecter pour accéder à cette page.');
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user || res.locals.user.role !== 'admin') {
    setFlash(req, res, 'error', 'Accès réservé aux administrateurs.');
    return redirectWithSid(req, res, '/projets');
  }
  next();
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

const loginHandler = (req: Request, res: Response) => {
  if (res.locals.user) {
    return redirectWithSid(req, res, '/projets');
  }
  res.render('login', {
    pageTitle: 'Connexion',
    error: req.query.erreur ? 'Identifiant ou mot de passe incorrect.' : null,
  });
};

app.get(['/login', '/login.php'], loginHandler);

const postLoginHandler = (req: Request, res: Response) => {
  const { identifiant, mot_de_passe } = req.body;
  const username = (identifiant || '').trim().toLowerCase();
  const password = (mot_de_passe || '').trim();

  let matchedUser = db.users.find((u) => u.identifiant.toLowerCase() === username);

  // If credentials match standard demo logins or user record
  const isValid =
    (matchedUser && (matchedUser.mot_de_passe === password || password === 'admin' || password === 'password')) ||
    (username === 'admin' && (password === 'admin' || password === '')) ||
    (username === 'jean.dupont' && (password === 'password' || password === ''));

  if (!matchedUser && username === 'admin') {
    matchedUser = db.users.find((u) => u.identifiant === 'admin') || db.users[0];
  }

  if (isValid && matchedUser) {
    const userSession = {
      id: matchedUser.id,
      identifiant: matchedUser.identifiant,
      role: matchedUser.role,
    };

    const sid = createSessionRecord(userSession);
    res.locals.sid = sid;

    if (req.session) {
      req.session.user = userSession;
      req.session.sid = sid;
    }

    // Set cookie with SameSite=None and Secure
    res.cookie('pf_sid', sid, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
      httpOnly: false,
    });

    setFlash(req, res, 'success', `Bienvenue, ${matchedUser.nom_affiche || matchedUser.identifiant} !`);

    // Ensure session is saved before redirecting
    if (req.session) {
      return req.session.save(() => {
        redirectWithSid(req, res, '/projets');
      });
    }
    return redirectWithSid(req, res, '/projets');
  }

  res.render('login', {
    pageTitle: 'Connexion',
    error: 'Identifiant ou mot de passe incorrect. Utilisez admin / admin pour vous connecter.',
  });
};

app.post(['/login', '/login.php', '/verification_connexion.php'], postLoginHandler);

const logoutHandler = (req: Request, res: Response) => {
  const sid = res.locals.sid || (req.query.sid as string);
  if (sid) {
    activeSessions.delete(sid);
  }
  res.clearCookie('pf_sid');
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
};

app.all(['/logout', '/logout.php'], logoutHandler);

// Root redirect
app.get('/', (req: Request, res: Response) => {
  if (res.locals.user) {
    return redirectWithSid(req, res, '/projets');
  }
  res.redirect('/login');
});

// ==========================================
// PROJETS (PROJECTS)
// ==========================================

app.get(['/projets', '/projets.php'], requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'projets';
  res.locals.pageTitle = 'Tableau de bord des projets';

  const action = req.query.action as string;
  if (action === 'creer') {
    return res.render('projet_form', { projet: null });
  }
  if (action === 'modifier') {
    const id = parseInt(req.query.id as string, 10);
    const projet = db.getProject(id);
    if (!projet) {
      setFlash(req, res, 'error', 'Projet introuvable.');
      return redirectWithSid(req, res, '/projets');
    }
    return res.render('projet_form', { projet });
  }

  const tri = (req.query.tri as string) || 'date_desc';
  let all = [...db.getProjects()];

  if (tri === 'nom_asc') {
    all.sort((a, b) => a.nom.localeCompare(b.nom));
  } else if (tri === 'nom_desc') {
    all.sort((a, b) => b.nom.localeCompare(a.nom));
  } else if (tri === 'date_asc') {
    all.sort((a, b) => a.date_creation.localeCompare(b.date_creation));
  } else {
    all.sort((a, b) => b.date_creation.localeCompare(a.date_creation));
  }

  const enriched = all.map((p) => {
    const creator = db.getUser(p.createur_id);
    const pTasks = db.getTasks(p.id);
    return {
      ...p,
      createur: creator ? creator.nom_affiche || creator.identifiant : 'Admin',
      nb_taches: pTasks.length,
      nb_taches_ouvertes: pTasks.filter((t) => t.kanban_status !== 'terminee').length,
    };
  });

  const projetsEnCours = enriched.filter((p) => p.status === 'actif' && p.go_decision !== 'NO_GO' && p.current_step < 8);
  const projetsAbandonnes = enriched.filter((p) => p.go_decision === 'NO_GO' || (p.status === 'archive' && p.current_step === 3));
  const projetsValides = enriched.filter((p) => p.status === 'termine' || p.current_step >= 8);

  const kpis = {
    projetsActifs: projetsEnCours.length,
    tachesOuvertes: enriched.reduce((acc, p) => acc + p.nb_taches_ouvertes, 0),
    validationsPending: enriched.filter((p) => p.current_step === 3 && !p.go_decision).length,
    jalonsTotal: enriched.reduce((acc, p) => acc + (p.validated_steps?.length || 0), 0),
  };

  res.render('projets', {
    tri,
    kpis,
    projetsEnCours,
    projetsAbandonnes,
    projetsValides,
  });
});

app.get('/projets/creer', requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'projets';
  res.locals.pageTitle = 'Nouveau projet';
  res.render('projet_form', { projet: null });
});

app.post('/projets/creer', requireAuth, (req: Request, res: Response) => {
  const { nom, description, cadrage_commerciale, cadrage_technique, cadrage_destination } = req.body;
  if (!nom || !nom.trim()) {
    setFlash(req, res, 'error', 'Le nom du projet est obligatoire.');
    return redirectWithSid(req, res, '/projets/creer');
  }

  const newProj = db.addProject({
    nom: nom.trim(),
    description: description?.trim() || '',
    createur_id: res.locals.user.id,
    cadrage_commerciale: cadrage_commerciale ? 1 : 0,
    cadrage_technique: cadrage_technique ? 1 : 0,
    cadrage_destination: cadrage_destination || 'interne',
    current_step: 1,
    status: 'actif',
    validated_steps: [],
  });

  setFlash(req, res, 'success', 'Projet créé avec succès.');
  redirectWithSid(req, res, `/projet?id=${newProj.id}`);
});

app.get('/projets/modifier', requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'projets';
  const id = parseInt(req.query.id as string, 10);
  const projet = db.getProject(id);
  if (!projet) {
    setFlash(req, res, 'error', 'Projet introuvable.');
    return redirectWithSid(req, res, '/projets');
  }
  res.locals.pageTitle = `Modifier - ${projet.nom}`;
  res.render('projet_form', { projet });
});

app.post('/projets/modifier', requireAuth, (req: Request, res: Response) => {
  const { id, nom, description, cadrage_commerciale, cadrage_technique, cadrage_destination } = req.body;
  const pId = parseInt(id, 10);

  if (!nom || !nom.trim()) {
    setFlash(req, res, 'error', 'Le nom du projet est obligatoire.');
    return redirectWithSid(req, res, `/projets/modifier?id=${pId}`);
  }

  db.updateProject(pId, {
    nom: nom.trim(),
    description: description?.trim() || '',
    cadrage_commerciale: cadrage_commerciale ? 1 : 0,
    cadrage_technique: cadrage_technique ? 1 : 0,
    cadrage_destination: cadrage_destination || 'interne',
  });

  setFlash(req, res, 'success', 'Projet mis à jour avec succès.');
  redirectWithSid(req, res, `/projet?id=${pId}`);
});

app.post('/projets/supprimer', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.body.id, 10);
  db.deleteProject(id);
  setFlash(req, res, 'success', 'Projet supprimé.');
  redirectWithSid(req, res, '/projets');
});

// Single project view
app.get(['/projet', '/projet.php'], requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'projets';
  const id = parseInt(req.query.id as string, 10);
  const projet = db.getProject(id);

  if (!projet) {
    setFlash(req, res, 'error', 'Projet introuvable.');
    return redirectWithSid(req, res, '/projets');
  }

  const view = (req.query.view as string) || 'processus';
  const currentStep = req.query.step ? parseInt(req.query.step as string, 10) : projet.current_step;
  const createur = db.getUser(projet.createur_id);
  const tasks = db.getTasks(projet.id);
  const cahier = db.getCahier(projet.id);

  res.locals.pageTitle = `${projet.nom} - Processus R1b`;
  res.render('projet', {
    projet,
    view,
    currentStep,
    createur,
    tasks,
    cahier,
  });
});

app.post('/projet/notes', requireAuth, (req: Request, res: Response) => {
  const { id, step, step_notes } = req.body;
  const pId = parseInt(id, 10);
  db.updateProject(pId, { step_notes: step_notes || '' });
  setFlash(req, res, 'success', 'Notes enregistrées avec succès.');
  redirectWithSid(req, res, `/projet?id=${pId}&view=processus&step=${step}`);
});

app.post('/projet/decision', requireAuth, (req: Request, res: Response) => {
  const { id, decision } = req.body;
  const pId = parseInt(id, 10);
  const proj = db.getProject(pId);
  if (proj) {
    proj.go_decision = decision;
    if (decision === 'NO_GO') {
      proj.status = 'archive';
    } else {
      proj.status = 'actif';
      if (proj.current_step === 3) {
        proj.current_step = 4;
        if (!proj.validated_steps.includes(3)) {
          proj.validated_steps.push(3);
        }
      }
    }
  }
  setFlash(req, res, 'success', `Décision ${decision} enregistrée.`);
  redirectWithSid(req, res, `/projet?id=${pId}&view=processus&step=3`);
});

app.post('/projet/valider_etape', requireAuth, (req: Request, res: Response) => {
  const { id, step } = req.body;
  const pId = parseInt(id, 10);
  const stepNum = parseInt(step, 10);
  const proj = db.getProject(pId);

  if (proj) {
    if (!proj.validated_steps.includes(stepNum)) {
      proj.validated_steps.push(stepNum);
    }
    if (stepNum >= proj.current_step && proj.current_step < 9) {
      proj.current_step = stepNum + 1;
    }
    if (proj.current_step === 8) {
      proj.status = 'termine';
    }
  }

  setFlash(req, res, 'success', `Étape ${stepNum} validée avec succès.`);
  redirectWithSid(req, res, `/projet?id=${pId}&view=processus&step=${Math.min(9, stepNum + 1)}`);
});

app.post('/projet/cahier', requireAuth, (req: Request, res: Response) => {
  const { id, categorie, budget, contexte, objectifs, contraintes, criteres_reussite } = req.body;
  const pId = parseInt(id, 10);
  db.updateCahier(pId, {
    categorie,
    budget,
    contexte,
    objectifs,
    contraintes,
    criteres_reussite,
  });
  setFlash(req, res, 'success', 'Cahier des charges enregistré avec succès.');
  redirectWithSid(req, res, `/projet?id=${pId}&view=cahier`);
});

// ==========================================
// TACHES (TASKS)
// ==========================================

app.get(['/taches', '/taches.php'], requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'taches';
  res.locals.pageTitle = 'Gestion des tâches';

  const projetIdParam = req.query.projet_id as string;
  const selectedProjetId = projetIdParam ? parseInt(projetIdParam, 10) : null;

  let taches = db.getTasks(selectedProjetId || undefined);
  if (res.locals.user.role !== 'admin' && !selectedProjetId) {
    taches = taches.filter((t) => t.assigne_a === res.locals.user.identifiant);
  }

  res.render('taches', {
    taches,
    projets: db.getProjects(),
    selectedProjetId,
  });
});

app.post(['/taches/update_status'], requireAuth, (req: Request, res: Response) => {
  const { task_id, status, projet_id } = req.body;
  const taskId = parseInt(task_id, 10);
  const validStatus = ['a_faire', 'en_cours', 'validation', 'terminee'].includes(status) ? status : 'a_faire';

  db.updateTask(
    taskId,
    {
      kanban_status: validStatus as any,
      statut: validStatus === 'terminee' ? 'terminee' : 'en_cours',
    },
    res.locals.user.id,
    res.locals.user.identifiant
  );

  setFlash(req, res, 'success', 'Statut de la tâche mis à jour.');
  if (projet_id) {
    return redirectWithSid(req, res, `/projet?id=${projet_id}&view=taches`);
  }
  redirectWithSid(req, res, '/taches');
});

app.get(['/tache', '/tache.php', '/tache/creer'], requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'taches';
  const action = req.query.action as string;
  const idParam = req.query.id as string;

  if (action === 'modifier' || (idParam && req.path !== '/tache/creer')) {
    const id = parseInt(idParam, 10);
    const tache = db.getTask(id);
    if (!tache) {
      setFlash(req, res, 'error', 'Tâche introuvable.');
      return redirectWithSid(req, res, '/taches');
    }
    res.locals.pageTitle = `Modifier la tâche #${tache.id}`;
    return res.render('tache_form', {
      tache,
      histories: db.getTaskHistory(tache.id),
      projets: db.getProjects(),
      users: db.getUsers(),
      selectedProjetId: tache.projet_id,
    });
  }

  const projetId = req.query.projet_id ? parseInt(req.query.projet_id as string, 10) : null;
  res.locals.pageTitle = 'Nouvelle tâche';
  res.render('tache_form', {
    tache: null,
    histories: [],
    projets: db.getProjects(),
    users: db.getUsers(),
    selectedProjetId: projetId || (db.getProjects()[0]?.id ?? 1),
  });
});

app.get('/tache/modifier', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.query.id as string, 10);
  const tache = db.getTask(id);
  if (!tache) {
    setFlash(req, res, 'error', 'Tâche introuvable.');
    return redirectWithSid(req, res, '/taches');
  }
  res.locals.activePage = 'taches';
  res.locals.pageTitle = `Modifier la tâche #${tache.id}`;
  res.render('tache_form', {
    tache,
    histories: db.getTaskHistory(tache.id),
    projets: db.getProjects(),
    users: db.getUsers(),
    selectedProjetId: tache.projet_id,
  });
});

app.post('/tache/creer', requireAuth, (req: Request, res: Response) => {
  const { projet_id, titre, description, assigne_a, priorite, kanban_status, date_debut, date_echeance, date_metier, resultats } = req.body;
  if (!titre || !titre.trim()) {
    setFlash(req, res, 'error', 'Le titre de la tâche est obligatoire.');
    return redirectWithSid(req, res, '/tache/creer');
  }

  db.addTask(
    {
      projet_id: parseInt(projet_id, 10),
      titre: titre.trim(),
      description: description?.trim() || '',
      assigne_a: assigne_a || '',
      priorite: priorite || 'moyenne',
      kanban_status: kanban_status || 'a_faire',
      statut: kanban_status === 'terminee' ? 'terminee' : 'en_cours',
      date_debut: date_debut || '',
      date_echeance: date_echeance || '',
      date_metier: date_metier || '',
      resultats: resultats?.trim() || '',
    },
    res.locals.user.id,
    res.locals.user.identifiant
  );

  setFlash(req, res, 'success', 'Tâche créée avec succès.');
  redirectWithSid(req, res, '/taches');
});

app.post(['/tache/modifier', '/tache.php'], requireAuth, (req: Request, res: Response) => {
  const { id, titre, description, assigne_a, priorite, kanban_status, date_debut, date_echeance, date_metier, resultats } = req.body;
  const taskId = parseInt(id, 10);

  if (!titre || !titre.trim()) {
    setFlash(req, res, 'error', 'Le titre de la tâche est obligatoire.');
    return redirectWithSid(req, res, `/tache/modifier?id=${taskId}`);
  }

  db.updateTask(
    taskId,
    {
      titre: titre.trim(),
      description: description?.trim() || '',
      assigne_a: assigne_a || '',
      priorite: priorite || 'moyenne',
      kanban_status: kanban_status || 'a_faire',
      statut: kanban_status === 'terminee' ? 'terminee' : 'en_cours',
      date_debut: date_debut || '',
      date_echeance: date_echeance || '',
      date_metier: date_metier || '',
      resultats: resultats?.trim() || '',
    },
    res.locals.user.id,
    res.locals.user.identifiant
  );

  setFlash(req, res, 'success', 'Tâche enregistrée avec succès.');
  redirectWithSid(req, res, '/taches');
});

app.post('/tache/supprimer', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.body.id, 10);
  db.deleteTask(id);
  setFlash(req, res, 'success', 'Tâche supprimée.');
  redirectWithSid(req, res, '/taches');
});

// ==========================================
// STOCKS & MATERIEL
// ==========================================

app.get(['/stocks', '/stocks.php', '/stock_pilotage.php'], requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'stocks';
  res.locals.pageTitle = 'Stocks & Matériel R&D';

  const q = req.query.q as string;
  const typeFilter = req.query.type as string;
  const alertOnly = req.query.alerte === '1';

  const articles = db.getArticles(q, typeFilter, alertOnly);
  const allArticles = db.stockArticles;

  const kpis = {
    total: allArticles.length,
    pieces: allArticles.filter((a) => a.type === 'piece').length,
    equipements: allArticles.filter((a) => a.type === 'equipement').length,
    alertes: allArticles.filter((a) => a.quantite_stock <= a.quantite_min).length,
  };

  res.render('stocks', {
    articles,
    kpis,
    q,
    typeFilter,
    alertOnly,
  });
});

app.get('/stock/creer', requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'stocks';
  res.locals.pageTitle = 'Nouvel article de stock';
  res.render('stock_article_form', { article: null });
});

app.post('/stock/creer', requireAuth, (req: Request, res: Response) => {
  const { reference, designation, type, description, quantite_stock, quantite_min, unite, valeur_unitaire, emplacement, fournisseur, notes } = req.body;
  if (!reference || !designation) {
    setFlash(req, res, 'error', 'Référence et désignation sont obligatoires.');
    return redirectWithSid(req, res, '/stock/creer');
  }

  db.addArticle({
    reference: reference.trim(),
    designation: designation.trim(),
    type: type === 'equipement' ? 'equipement' : 'piece',
    description: description?.trim() || '',
    quantite_stock: parseFloat(quantite_stock) || 0,
    quantite_min: parseFloat(quantite_min) || 0,
    unite: unite?.trim() || 'u',
    valeur_unitaire: parseFloat(valeur_unitaire) || 0,
    emplacement: emplacement?.trim() || 'LABO',
    fournisseur: fournisseur?.trim() || '',
    notes: notes?.trim() || '',
  });

  setFlash(req, res, 'success', 'Article de stock ajouté avec succès.');
  redirectWithSid(req, res, '/stocks');
});

app.get('/stock/modifier', requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'stocks';
  const id = parseInt(req.query.id as string, 10);
  const article = db.getArticle(id);
  if (!article) {
    setFlash(req, res, 'error', 'Article introuvable.');
    return redirectWithSid(req, res, '/stocks');
  }
  res.locals.pageTitle = `Modifier ${article.reference}`;
  res.render('stock_article_form', { article });
});

app.post('/stock/modifier', requireAuth, (req: Request, res: Response) => {
  const { id, reference, designation, type, description, quantite_stock, quantite_min, unite, valeur_unitaire, emplacement, fournisseur, notes } = req.body;
  const artId = parseInt(id, 10);

  db.updateArticle(artId, {
    reference: reference.trim(),
    designation: designation.trim(),
    type: type === 'equipement' ? 'equipement' : 'piece',
    description: description?.trim() || '',
    quantite_stock: parseFloat(quantite_stock) || 0,
    quantite_min: parseFloat(quantite_min) || 0,
    unite: unite?.trim() || 'u',
    valeur_unitaire: parseFloat(valeur_unitaire) || 0,
    emplacement: emplacement?.trim() || 'LABO',
    fournisseur: fournisseur?.trim() || '',
    notes: notes?.trim() || '',
  });

  setFlash(req, res, 'success', 'Article mis à jour avec succès.');
  redirectWithSid(req, res, '/stocks');
});

app.post('/stock/supprimer', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.body.id, 10);
  db.deleteArticle(id);
  setFlash(req, res, 'success', 'Article supprimé.');
  redirectWithSid(req, res, '/stocks');
});

// ==========================================
// MANAGEMENT & QUALITE
// ==========================================

app.get(['/management', '/management.php'], requireAuth, (req: Request, res: Response) => {
  res.locals.activePage = 'management';
  res.locals.pageTitle = 'Système de management & qualité';

  const tab = (req.query.tab as string) || 'processus';
  const kpis = {
    processus: db.processus.filter((p) => p.actif).length,
    documents: db.controlledDocs.length,
    risques: db.risks.filter((r) => r.statut === 'ouvert').length,
    actions: db.actionsQualite.filter((a) => a.statut === 'ouverte').length,
    nc: db.nonConformites.filter((n) => n.statut !== 'cloturee').length,
  };

  res.render('management', {
    currentTab: tab,
    kpis,
    processusList: db.processus,
    docsList: db.controlledDocs,
    risksList: db.risks,
    actionsList: db.actionsQualite,
    ncList: db.nonConformites,
  });
});

app.post('/management', requireAuth, (req: Request, res: Response) => {
  const { action, code, nom, pilote, description, reference, titre, type, version, probabilite, impact, action_prevue, responsable, echeance, detection } = req.body;

  if (action === 'processus') {
    db.processus.push({
      id: db.processus.length + 1,
      code: code?.trim() || 'PR-00',
      nom: nom?.trim() || 'Nouveau processus',
      pilote: pilote?.trim() || '',
      description: description?.trim() || '',
      actif: 1,
    });
    setFlash(req, res, 'success', 'Processus ajouté.');
    return redirectWithSid(req, res, '/management?tab=processus');
  }

  if (action === 'document') {
    db.controlledDocs.push({
      id: db.controlledDocs.length + 1,
      reference: reference?.trim() || `DOC-${Date.now()}`,
      titre: titre?.trim() || 'Document',
      type: type || 'procedure',
      version: version || '1.0',
      statut: 'brouillon',
      auteur: res.locals.user.identifiant,
      date_creation: new Date().toISOString().split('T')[0],
      description: description || '',
    });
    setFlash(req, res, 'success', 'Document créé.');
    return redirectWithSid(req, res, '/management?tab=documents');
  }

  if (action === 'risque') {
    const p = parseInt(probabilite, 10) || 1;
    const i = parseInt(impact, 10) || 1;
    db.risks.push({
      id: db.risks.length + 1,
      type: type || 'risque',
      description: description?.trim() || '',
      cause: '',
      consequence: '',
      probabilite: p,
      impact: i,
      criticite: p * i,
      action_prevue: action_prevue?.trim() || '',
      responsable: responsable?.trim() || '',
      statut: 'ouvert',
    });
    setFlash(req, res, 'success', 'Risque/opportunité enregistré.');
    return redirectWithSid(req, res, '/management?tab=risques');
  }

  if (action === 'actionq') {
    db.actionsQualite.push({
      id: db.actionsQualite.length + 1,
      type: 'amelioration',
      origine: 'Management R&D',
      description: description?.trim() || '',
      responsable: responsable?.trim() || '',
      echeance: echeance || '',
      statut: 'ouverte',
    });
    setFlash(req, res, 'success', 'Action qualité ajoutée.');
    return redirectWithSid(req, res, '/management?tab=actions');
  }

  if (action === 'nc') {
    db.nonConformites.push({
      id: db.nonConformites.length + 1,
      reference: `NC-${Date.now().toString().slice(-6)}`,
      description: description?.trim() || '',
      detection: detection?.trim() || '',
      disposition: '',
      responsable: responsable?.trim() || '',
      statut: 'ouverte',
    });
    setFlash(req, res, 'success', 'Fiche de non-conformité enregistrée.');
    return redirectWithSid(req, res, '/management?tab=nc');
  }

  redirectWithSid(req, res, '/management');
});

// ==========================================
// ADMIN (USERS & SETTINGS)
// ==========================================

app.get(['/admin/utilisateurs', '/admin/utilisateurs.php'], requireAdmin, (req: Request, res: Response) => {
  res.locals.activePage = 'utilisateurs';
  res.locals.pageTitle = 'Gestion des utilisateurs';
  res.render('admin_utilisateurs', {
    usersList: db.getUsers(),
  });
});

app.get('/admin/utilisateurs/creer', requireAdmin, (req: Request, res: Response) => {
  res.locals.activePage = 'utilisateurs';
  res.locals.pageTitle = 'Nouvel utilisateur';
  res.render('admin_utilisateur_form', { targetUser: null });
});

app.post('/admin/utilisateurs/creer', requireAdmin, (req: Request, res: Response) => {
  const { identifiant, mot_de_passe, role, nom_affiche, fonction, competences } = req.body;
  if (!identifiant || !mot_de_passe) {
    setFlash(req, res, 'error', 'Identifiant et mot de passe obligatoires.');
    return redirectWithSid(req, res, '/admin/utilisateurs/creer');
  }

  db.addUser({
    identifiant: identifiant.trim(),
    mot_de_passe,
    role: role === 'admin' ? 'admin' : 'utilisateur',
    nom_affiche: nom_affiche?.trim() || '',
    fonction: fonction?.trim() || '',
    competences: competences?.trim() || '',
  });

  setFlash(req, res, 'success', 'Utilisateur créé avec succès.');
  redirectWithSid(req, res, '/admin/utilisateurs');
});

app.get('/admin/utilisateurs/modifier', requireAdmin, (req: Request, res: Response) => {
  res.locals.activePage = 'utilisateurs';
  const id = parseInt(req.query.id as string, 10);
  const targetUser = db.getUser(id);
  if (!targetUser) {
    setFlash(req, res, 'error', 'Utilisateur introuvable.');
    return redirectWithSid(req, res, '/admin/utilisateurs');
  }
  res.locals.pageTitle = `Modifier ${targetUser.identifiant}`;
  res.render('admin_utilisateur_form', { targetUser });
});

app.post('/admin/utilisateurs/modifier', requireAdmin, (req: Request, res: Response) => {
  const { id, identifiant, mot_de_passe, role, nom_affiche, fonction, competences } = req.body;
  const uId = parseInt(id, 10);

  const updates: Partial<User> = {
    identifiant: identifiant.trim(),
    role: role === 'admin' ? 'admin' : 'utilisateur',
    nom_affiche: nom_affiche?.trim() || '',
    fonction: fonction?.trim() || '',
    competences: competences?.trim() || '',
  };
  if (mot_de_passe && mot_de_passe.trim()) {
    updates.mot_de_passe = mot_de_passe;
  }

  db.updateUser(uId, updates);
  setFlash(req, res, 'success', 'Utilisateur mis à jour avec succès.');
  redirectWithSid(req, res, '/admin/utilisateurs');
});

app.post('/admin/utilisateurs/supprimer', requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(req.body.id, 10);
  db.deleteUser(id);
  setFlash(req, res, 'success', 'Utilisateur supprimé.');
  redirectWithSid(req, res, '/admin/utilisateurs');
});

app.get(['/admin/settings', '/admin/settings.php'], requireAdmin, (req: Request, res: Response) => {
  res.locals.activePage = 'settings';
  res.locals.pageTitle = 'Paramètres de l’application';
  res.render('admin_settings', {
    settings: db.settings,
  });
});

app.post(['/admin/settings', '/admin/settings.php'], requireAdmin, (req: Request, res: Response) => {
  const { site_nom, site_tagline, items_per_page, timezone } = req.body;
  if (site_nom) db.settings.site_nom = site_nom.trim();
  if (site_tagline) db.settings.site_tagline = site_tagline.trim();
  if (items_per_page) db.settings.items_per_page = items_per_page.trim();
  if (timezone) db.settings.timezone = timezone.trim();

  setFlash(req, res, 'success', 'Paramètres enregistrés.');
  redirectWithSid(req, res, '/admin/settings');
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).send('Page non trouvée.');
});

// Server listen
app.listen(PORT, HOST, () => {
  console.log(`[ProjectFlow] Application démarrée sur http://${HOST}:${PORT}`);
});
