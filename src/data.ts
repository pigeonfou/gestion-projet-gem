export interface User {
  id: number;
  identifiant: string;
  mot_de_passe: string;
  role: 'admin' | 'utilisateur';
  nom_affiche: string;
  fonction: string;
  competences: string;
  date_creation: string;
}

export interface Project {
  id: number;
  nom: string;
  description: string;
  createur_id: number;
  current_step: number;
  go_decision?: string;
  step_notes?: string;
  status: 'actif' | 'termine' | 'archive';
  cadrage_commerciale: number;
  cadrage_technique: number;
  cadrage_destination: 'interne' | 'externe' | null;
  validated_steps: number[];
  date_creation: string;
}

export interface Task {
  id: number;
  projet_id: number;
  titre: string;
  description: string;
  priorite: 'basse' | 'moyenne' | 'haute' | 'urgente';
  statut: 'a_faire' | 'en_cours' | 'terminee';
  kanban_status: 'a_faire' | 'en_cours' | 'validation' | 'terminee';
  assigne_a: string;
  date_creation: string;
  date_echeance?: string;
  date_debut?: string;
  date_metier?: string;
  dependance_id?: number | null;
  resultats?: string;
}

export interface TaskHistory {
  id: number;
  tache_id: number;
  utilisateur_id: number;
  identifiant: string;
  action: string;
  details: string;
  date_action: string;
}

export interface StockArticle {
  id: number;
  reference: string;
  designation: string;
  type: 'piece' | 'equipement';
  description: string;
  quantite_stock: number;
  quantite_min: number;
  unite: string;
  valeur_unitaire: number;
  taxe: string;
  emplacement: string;
  fournisseur: string;
  notes: string;
  created_at: string;
}

export interface StockMovement {
  id: number;
  article_id: number;
  type: string;
  quantite: number;
  emplacement_destination?: string;
  emplacement_source?: string;
  projet_id?: number;
  reference_externe?: string;
  note?: string;
  created_at: string;
}

export interface Processus {
  id: number;
  code: string;
  nom: string;
  pilote: string;
  description: string;
  actif: number;
}

export interface ControlledDoc {
  id: number;
  reference: string;
  titre: string;
  type: string;
  processus_id?: number | null;
  projet_id?: number | null;
  statut: string;
  version: string;
  auteur: string;
  date_creation: string;
  description: string;
}

export interface Risk {
  id: number;
  processus_id?: number | null;
  projet_id?: number | null;
  type: 'risque' | 'opportunite';
  description: string;
  cause: string;
  consequence: string;
  probabilite: number;
  impact: number;
  criticite: number;
  action_prevue: string;
  responsable: string;
  echeance?: string;
  statut: string;
}

export interface ActionQualite {
  id: number;
  processus_id?: number | null;
  projet_id?: number | null;
  type: string;
  origine: string;
  description: string;
  responsable: string;
  echeance?: string;
  statut: string;
}

export interface NonConformite {
  id: number;
  reference: string;
  processus_id?: number | null;
  projet_id?: number | null;
  description: string;
  detection: string;
  disposition: string;
  responsable: string;
  echeance?: string;
  statut: string;
}

export interface Cahier {
  id: number;
  projet_id: number;
  categorie: string;
  contexte: string;
  objectifs: string;
  contraintes: string;
  dates_info: string;
  budget: string;
  ressources: string;
  risques: string;
  criteres_reussite: string;
  date_maj: string;
  fonctions: { id: number; nom: string; description: string; obligatoire: boolean }[];
  specs_techniques: { id: number; type: string; description: string; cout: number; delai: string }[];
}

export const r1bStepsInfo: Record<number, { key: string; title: string; phase: string }> = {
  1: { key: 'besoin', title: 'Mise en forme du besoin', phase: 'cahier' },
  2: { key: 'etudes', title: 'Études capacités & investissement', phase: 'capacite' },
  3: { key: 'go_nogo', title: 'GO / NO GO', phase: 'go_nogo' },
  4: { key: 'composants', title: 'Recherche composants & matériels', phase: 'composants' },
  5: { key: 'achats', title: 'Achat composants & matériels', phase: 'achats' },
  6: { key: 'proto', title: 'Fabrication / Prototypage', phase: 'proto' },
  7: { key: 'tests', title: 'Tests de conformité', phase: 'tests' },
  8: { key: 'livraison', title: 'Livraison DG', phase: 'livraison' },
  9: { key: 'archivage', title: 'Archivage → R2 Vente', phase: 'archivage' },
};

class DataStore {
  users: User[] = [];
  projects: Project[] = [];
  tasks: Task[] = [];
  taskHistories: TaskHistory[] = [];
  stockArticles: StockArticle[] = [];
  stockMovements: StockMovement[] = [];
  cahiers: Cahier[] = [];
  processus: Processus[] = [];
  controlledDocs: ControlledDoc[] = [];
  risks: Risk[] = [];
  actionsQualite: ActionQualite[] = [];
  nonConformites: NonConformite[] = [];
  settings: Record<string, string> = {};

  private nextUserId = 1;
  private nextProjectId = 1;
  private nextTaskId = 1;
  private nextHistoryId = 1;
  private nextArticleId = 1;
  private nextMovementId = 1;
  private nextCahierId = 1;
  private nextProcessusId = 1;
  private nextDocId = 1;
  private nextRiskId = 1;
  private nextActionId = 1;
  private nextNcId = 1;

  constructor() {
    this.seed();
  }

  seed() {
    // Settings
    this.settings = {
      site_nom: 'ProjectFlow',
      site_tagline: 'Gestion de projets, processus & documentation',
      search_highlight_color: '#fef08a',
      items_per_page: '20',
      timezone: 'Europe/Paris',
      date_format: 'd/m/Y',
    };

    // Users
    this.users = [
      {
        id: this.nextUserId++,
        identifiant: 'admin',
        mot_de_passe: 'admin',
        role: 'admin',
        nom_affiche: 'Administrateur',
        fonction: 'Directeur Technique',
        competences: 'Gestion de projet, Électronique, Firmware, Direction R&D',
        date_creation: '2026-01-01 09:00:00',
      },
      {
        id: this.nextUserId++,
        identifiant: 'jean.dupont',
        mot_de_passe: 'password',
        role: 'utilisateur',
        nom_affiche: 'Jean Dupont',
        fonction: 'Ingénieur Conception R&D',
        competences: 'Conception 3D, CAO KiCad, Prototypage rapide, Bancs de test',
        date_creation: '2026-01-10 10:30:00',
      },
      {
        id: this.nextUserId++,
        identifiant: 'claire.martin',
        mot_de_passe: 'password',
        role: 'utilisateur',
        nom_affiche: 'Claire Martin',
        fonction: 'Responsable Qualité & Méthodes',
        competences: 'Normes ISO 9001, Traçabilité, Audits processus, Gestion des risques',
        date_creation: '2026-01-15 14:00:00',
      },
    ];

    // Projects
    this.projects = [
      {
        id: this.nextProjectId++,
        nom: 'Boîtier IoT Industriel V2',
        description: 'Capteur de température et vibration sans fil avec connectivité LoRaWAN pour environnement industriel sévère.',
        createur_id: 1,
        current_step: 4,
        status: 'actif',
        cadrage_commerciale: 1,
        cadrage_technique: 1,
        cadrage_destination: 'externe',
        validated_steps: [1, 2, 3],
        date_creation: '2026-02-15 10:00:00',
      },
      {
        id: this.nextProjectId++,
        nom: 'Banc de test automatisé PCB',
        description: 'Banc de programmation et de test fonctionnel pour cartes de série.',
        createur_id: 1,
        current_step: 2,
        status: 'actif',
        cadrage_commerciale: 0,
        cadrage_technique: 1,
        cadrage_destination: 'interne',
        validated_steps: [1],
        date_creation: '2026-03-01 14:30:00',
      },
      {
        id: this.nextProjectId++,
        nom: 'Passerelle Énergie Solaire',
        description: 'Système de gestion et transmission de données pour kits photovoltaïques autonomes.',
        createur_id: 2,
        current_step: 8,
        status: 'termine',
        cadrage_commerciale: 1,
        cadrage_technique: 0,
        cadrage_destination: 'externe',
        validated_steps: [1, 2, 3, 4, 5, 6, 7, 8],
        date_creation: '2025-11-10 09:15:00',
      },
      {
        id: this.nextProjectId++,
        nom: 'Module RFID Ultra-Haute Fréquence',
        description: 'Étude exploratoire de lecteur RFID longue portée. Abandonné suite à l’évaluation de rentabilité.',
        createur_id: 1,
        current_step: 3,
        go_decision: 'NO_GO',
        status: 'archive',
        cadrage_commerciale: 0,
        cadrage_technique: 1,
        cadrage_destination: 'interne',
        validated_steps: [1, 2],
        date_creation: '2026-01-08 11:20:00',
      },
    ];

    // Tasks
    this.tasks = [
      {
        id: this.nextTaskId++,
        projet_id: 1,
        titre: 'Sélectionner le microcontrôleur basse consommation',
        description: 'Comparer STM32WL55 et nRF52840 selon consommation en veille, coût et disponibilité.',
        priorite: 'haute',
        statut: 'terminee',
        kanban_status: 'terminee',
        assigne_a: 'jean.dupont',
        date_creation: '2026-02-16 11:00:00',
        date_debut: '2026-02-20',
        date_echeance: '2026-03-05',
        date_metier: '2026-03-04',
        resultats: 'STM32WL55 retenu pour modem LoRa intégré et excellente autonomie en veille.',
      },
      {
        id: this.nextTaskId++,
        projet_id: 1,
        titre: 'Routage de la carte PCB v1.0',
        description: 'Conception du schéma électronique et routage 4 couches sous KiCad avec respect des contraintes CEM.',
        priorite: 'urgente',
        statut: 'en_cours',
        kanban_status: 'en_cours',
        assigne_a: 'jean.dupont',
        date_creation: '2026-03-05 14:00:00',
        date_debut: '2026-03-10',
        date_echeance: '2026-03-25',
        dependance_id: 1,
        resultats: 'Schéma validé en revue interne, placement des composants en cours.',
      },
      {
        id: this.nextTaskId++,
        projet_id: 1,
        titre: 'Étude d’étanchéité boîtier IP67',
        description: 'Simulation mécanique par éléments finis et choix du joint silicone moulé.',
        priorite: 'moyenne',
        statut: 'a_faire',
        kanban_status: 'a_faire',
        assigne_a: 'jean.dupont',
        date_creation: '2026-03-06 09:30:00',
        date_debut: '2026-03-20',
        date_echeance: '2026-04-10',
      },
      {
        id: this.nextTaskId++,
        projet_id: 1,
        titre: 'Revue de conception préalable et nomenclature',
        description: 'Validation de l’approvisionnement et confirmation des délais composants.',
        priorite: 'haute',
        statut: 'en_cours',
        kanban_status: 'validation',
        assigne_a: 'admin',
        date_creation: '2026-03-08 16:00:00',
        date_debut: '2026-03-15',
        date_echeance: '2026-03-28',
        dependance_id: 2,
        resultats: 'BOM consolidée à 95%, attente cotation fournisseur antenne.',
      },
      {
        id: this.nextTaskId++,
        projet_id: 2,
        titre: 'Définition de l’architecture du banc de test',
        description: 'Identifier les points de contact pogo pins et tensions de référence.',
        priorite: 'moyenne',
        statut: 'terminee',
        kanban_status: 'terminee',
        assigne_a: 'admin',
        date_creation: '2026-03-01 15:00:00',
        date_debut: '2026-03-02',
        date_echeance: '2026-03-12',
        date_metier: '2026-03-11',
        resultats: 'Architecture validée avec 14 points de test et alimentation programmable.',
      },
      {
        id: this.nextTaskId++,
        projet_id: 2,
        titre: 'Usinage plaque de maintien POM',
        description: 'Programmer la découpe CNC pour la fixation de la carte sous test.',
        priorite: 'basse',
        statut: 'a_faire',
        kanban_status: 'a_faire',
        assigne_a: 'jean.dupont',
        date_creation: '2026-03-12 10:00:00',
        date_debut: '2026-03-25',
        date_echeance: '2026-04-05',
      },
    ];

    // Cahiers
    this.cahiers = [
      {
        id: this.nextCahierId++,
        projet_id: 1,
        categorie: 'Produit Électronique Connecté',
        contexte: 'Besoin formulé par le service commercial pour surveiller les parcs machines industriels sans câblage.',
        objectifs: 'Autonomie supérieure à 5 ans, portée LoRa 2km en milieu urbain dense, indice IP67.',
        contraintes: 'Dimensions maximales 80x50x30mm, température d’utilisation -20°C à +70°C.',
        dates_info: 'Prototype opérationnel attendu fin T2 2026.',
        budget: '25 000 € HT phase R&D',
        ressources: 'Ingénieur CAO (Jean Dupont), Responsable Technique (Admin).',
        risques: 'Approvisionnement composants RF critiques, certification LoRa Alliance.',
        criteres_reussite: 'Transmission de 1 message par heure avec taux de perte < 1%.',
        date_maj: '2026-03-10 17:00:00',
        fonctions: [
          { id: 1, nom: 'Mesure de vibration 3 axes', description: 'Accéléromètre MEMS numérique', obligatoire: true },
          { id: 2, nom: 'Mesure de température de contact', description: 'Capteur haute précision +/- 0.2°C', obligatoire: true },
          { id: 3, nom: 'Communication LoRaWAN', description: 'Bande EU868 classe A', obligatoire: true },
        ],
        specs_techniques: [
          { id: 1, type: 'Composant', description: 'STM32WL55CCU6 - MCU double cœur + Sub-GHz', cout: 4.85, delai: '2 semaines' },
          { id: 2, type: 'PCB', description: 'Circuit imprimé 4 couches FR4 TG150 ENIG', cout: 350.0, delai: '1 semaine' },
          { id: 3, type: 'Matériel', description: 'Boîtier aluminium usiné IP67 sur mesure', cout: 1200.0, delai: '3 semaines' },
        ],
      },
    ];

    // Stock Articles
    this.stockArticles = [
      {
        id: this.nextArticleId++,
        reference: 'REF-STM32WL',
        designation: 'Microcontrôleur STM32WL55CCU6 UFQFPN48',
        type: 'piece',
        description: 'SoC double cœur ARM Cortex-M4/M0+ avec émetteur-récepteur sub-GHz LoRa intégré.',
        quantite_stock: 45,
        quantite_min: 20,
        unite: 'u',
        valeur_unitaire: 4.85,
        taxe: 'HT',
        emplacement: 'LABO/CMS',
        fournisseur: 'Mouser Electronics',
        notes: 'Bobine entamée pour prototypes.',
        created_at: '2026-01-20 09:00:00',
      },
      {
        id: this.nextArticleId++,
        reference: 'REF-ANT-LORA',
        designation: 'Antenne hélicoïdale 868MHz CMS',
        type: 'piece',
        description: 'Antenne miniature céramique pour objets connectés LoRa/Sigfox.',
        quantite_stock: 80,
        quantite_min: 30,
        unite: 'u',
        valeur_unitaire: 1.2,
        taxe: 'HT',
        emplacement: 'LABO/CMS',
        fournisseur: 'Farnell',
        notes: 'Conditionnement par rouleau de 100.',
        created_at: '2026-01-22 10:00:00',
      },
      {
        id: this.nextArticleId++,
        reference: 'REF-BATT-LITH',
        designation: 'Pile Li-SOCl2 3.6V 2600mAh AA',
        type: 'piece',
        description: 'Pile haute énergie au chlorure de thionyle pour électronique longue durée.',
        quantite_stock: 12,
        quantite_min: 25,
        unite: 'u',
        valeur_unitaire: 6.5,
        taxe: 'HT',
        emplacement: 'LABO/CONNECTIQUE',
        fournisseur: 'RS Components',
        notes: 'Stock bas : alerte réapprovisionnement active !',
        created_at: '2026-02-01 11:30:00',
      },
      {
        id: this.nextArticleId++,
        reference: 'REF-OSCILLO',
        designation: 'Oscilloscope numérique 4 voies 100MHz Rigol',
        type: 'equipement',
        description: 'Équipement de laboratoire pour mise au point et analyse de signaux numériques.',
        quantite_stock: 2,
        quantite_min: 1,
        unite: 'u',
        valeur_unitaire: 850.0,
        taxe: 'HT',
        emplacement: 'LABO/EQUIPEMENTS',
        fournisseur: 'Conrad Pro',
        notes: 'Étalonnage à jour jusqu’en 2027.',
        created_at: '2025-10-15 14:00:00',
      },
      {
        id: this.nextArticleId++,
        reference: 'REF-FER-SOUD',
        designation: 'Station de soudage thermostatée Weller WT1010',
        type: 'equipement',
        description: 'Poste de soudage ESD sécurisé avec pannes fines pour CMS.',
        quantite_stock: 4,
        quantite_min: 2,
        unite: 'u',
        valeur_unitaire: 210.0,
        taxe: 'HT',
        emplacement: 'LABO/EQUIPEMENTS',
        fournisseur: 'RS Components',
        notes: 'Postes 1 à 4 sur paillasse R&D.',
        created_at: '2025-10-15 14:30:00',
      },
    ];

    // Stock movements
    this.stockMovements = [
      {
        id: this.nextMovementId++,
        article_id: 1,
        type: 'reception',
        quantite: 50,
        emplacement_destination: 'LABO/CMS',
        reference_externe: 'CMD-2026-018',
        note: 'Réception commande Mouser',
        created_at: '2026-01-20 10:15:00',
      },
      {
        id: this.nextMovementId++,
        article_id: 1,
        type: 'consommation',
        quantite: 5,
        emplacement_source: 'LABO/CMS',
        projet_id: 1,
        note: 'Montage cartes prototypes #1',
        created_at: '2026-03-01 16:00:00',
      },
    ];

    // Processus
    this.processus = [
      { id: this.nextProcessusId++, code: 'PR-01', nom: 'Conception et Développement R&D', pilote: 'Admin', description: 'De la capture du besoin à la qualification finale du produit.', actif: 1 },
      { id: this.nextProcessusId++, code: 'PR-02', nom: 'Gestion des Achats & Fournisseurs', pilote: 'Claire Martin', description: 'Sélection, qualification et suivi des approvisionnements.', actif: 1 },
      { id: this.nextProcessusId++, code: 'PR-03', nom: 'Assurance Qualité & Amélioration', pilote: 'Claire Martin', description: 'Maîtrise documentaire, traitement des NC et audits.', actif: 1 },
    ];

    // Controlled Docs
    this.controlledDocs = [
      { id: this.nextDocId++, reference: 'DOC-PRD-001', titre: 'Procédure générale de conception R1b', type: 'procedure', processus_id: 1, statut: 'approuve', version: '2.1', auteur: 'Admin', date_creation: '2026-01-05', description: 'Déroulé des 9 étapes du jalon commercial à la mise en vente.' },
      { id: this.nextDocId++, reference: 'DOC-QUAL-004', titre: 'Grille d’évaluation des risques projets', type: 'grille', processus_id: 3, statut: 'brouillon', version: '1.0', auteur: 'Claire Martin', date_creation: '2026-02-10', description: 'Méthodologie AMDEC produit et processus.' },
    ];

    // Risks
    this.risks = [
      { id: this.nextRiskId++, processus_id: 1, projet_id: 1, type: 'risque', description: 'Délai d’approvisionnement des composants RF LoRa critique', cause: 'Tension sur les semi-conducteurs mondiaux', consequence: 'Retard de 4 semaines sur les essais de conformité', probabilite: 3, impact: 4, criticite: 12, action_prevue: 'Commander un stock tampon dès la validation de l’étape 3', responsable: 'Admin', echeance: '2026-03-30', statut: 'ouvert' },
      { id: this.nextRiskId++, processus_id: 2, projet_id: 2, type: 'opportunite', description: 'Mutualisation des pannes de test entre les deux bancs', cause: 'Standardisation des dimensions PCB', consequence: 'Économie de 30% sur les pièces d’usure', probabilite: 4, impact: 3, criticite: 12, action_prevue: 'Créer une référence outillage commune au stock', responsable: 'Jean Dupont', echeance: '2026-04-15', statut: 'ouvert' },
    ];

    // Actions
    this.actionsQualite = [
      { id: this.nextActionId++, processus_id: 1, projet_id: 1, type: 'preventive', origine: 'Revue de conception R1b', description: 'Intégrer les filtres passe-bas harmoniques dès la v1 du schéma.', responsable: 'Jean Dupont', echeance: '2026-03-22', statut: 'ouverte' },
      { id: this.nextActionId++, processus_id: 3, projet_id: null, type: 'corrective', origine: 'Audit interne ISO 9001', description: 'Mettre à jour les fiches de poste du laboratoire R&D.', responsable: 'Claire Martin', echeance: '2026-04-30', statut: 'ouverte' },
    ];

    // Non-conformités
    this.nonConformites = [
      { id: this.nextNcId++, reference: 'NC-20260228-01', processus_id: 1, projet_id: 1, description: 'Empreinte CMS inversée sur le connecteur batterie v0', detection: 'Contrôle visuel au montage manuel', disposition: 'Câblage volant sur le prototype pour validation fonctionnelle, correction immédiate sur le layout', responsable: 'Jean Dupont', echeance: '2026-03-10', statut: 'en_cours' },
    ];
  }

  // Projects
  getProjects() {
    return this.projects;
  }

  getProject(id: number): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  addProject(data: Partial<Project>): Project {
    const proj: Project = {
      id: this.nextProjectId++,
      nom: data.nom || 'Nouveau projet',
      description: data.description || '',
      createur_id: data.createur_id || 1,
      current_step: data.current_step || 1,
      status: data.status || 'actif',
      cadrage_commerciale: data.cadrage_commerciale ? 1 : 0,
      cadrage_technique: data.cadrage_technique ? 1 : 0,
      cadrage_destination: data.cadrage_destination || null,
      validated_steps: data.validated_steps || [],
      date_creation: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    this.projects.unshift(proj);
    return proj;
  }

  updateProject(id: number, data: Partial<Project>): boolean {
    const proj = this.getProject(id);
    if (!proj) return false;
    Object.assign(proj, data);
    return true;
  }

  deleteProject(id: number): boolean {
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.projects.splice(idx, 1);
      this.tasks = this.tasks.filter((t) => t.projet_id !== id);
      return true;
    }
    return false;
  }

  // Tasks
  getTasks(projetId?: number): Task[] {
    if (projetId !== undefined) {
      return this.tasks.filter((t) => t.projet_id === projetId);
    }
    return this.tasks;
  }

  getTask(id: number): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  addTask(data: Partial<Task>, userId: number, userName: string): Task {
    const task: Task = {
      id: this.nextTaskId++,
      projet_id: data.projet_id || 1,
      titre: data.titre || 'Nouvelle tâche',
      description: data.description || '',
      priorite: data.priorite || 'moyenne',
      statut: data.statut || 'a_faire',
      kanban_status: data.kanban_status || 'a_faire',
      assigne_a: data.assigne_a || '',
      date_creation: new Date().toISOString().replace('T', ' ').substring(0, 19),
      date_debut: data.date_debut || '',
      date_echeance: data.date_echeance || '',
      date_metier: data.date_metier || '',
      dependance_id: data.dependance_id || null,
      resultats: data.resultats || '',
    };
    this.tasks.unshift(task);

    this.taskHistories.push({
      id: this.nextHistoryId++,
      tache_id: task.id,
      utilisateur_id: userId,
      identifiant: userName,
      action: 'création',
      details: JSON.stringify({ titre: task.titre, assigne: task.assigne_a, statut: task.kanban_status }),
      date_action: new Date().toISOString().replace('T', ' ').substring(0, 19),
    });

    return task;
  }

  updateTask(id: number, data: Partial<Task>, userId: number, userName: string): boolean {
    const task = this.getTask(id);
    if (!task) return false;
    Object.assign(task, data);

    this.taskHistories.push({
      id: this.nextHistoryId++,
      tache_id: task.id,
      utilisateur_id: userId,
      identifiant: userName,
      action: 'modification',
      details: JSON.stringify(data),
      date_action: new Date().toISOString().replace('T', ' ').substring(0, 19),
    });

    return true;
  }

  deleteTask(id: number): boolean {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.tasks.splice(idx, 1);
      return true;
    }
    return false;
  }

  getTaskHistory(taskId: number): TaskHistory[] {
    return this.taskHistories.filter((h) => h.tache_id === taskId).reverse();
  }

  // Stock
  getArticles(query?: string, type?: string, alerte?: boolean): StockArticle[] {
    let list = this.stockArticles;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((a) => a.reference.toLowerCase().includes(q) || a.designation.toLowerCase().includes(q) || a.emplacement.toLowerCase().includes(q));
    }
    if (type && (type === 'piece' || type === 'equipement')) {
      list = list.filter((a) => a.type === type);
    }
    if (alerte) {
      list = list.filter((a) => a.quantite_stock <= a.quantite_min);
    }
    return list;
  }

  getArticle(id: number): StockArticle | undefined {
    return this.stockArticles.find((a) => a.id === id);
  }

  addArticle(data: Partial<StockArticle>): StockArticle {
    const art: StockArticle = {
      id: this.nextArticleId++,
      reference: data.reference || `REF-${Date.now().toString().slice(-4)}`,
      designation: data.designation || 'Article sans nom',
      type: data.type || 'piece',
      description: data.description || '',
      quantite_stock: data.quantite_stock || 0,
      quantite_min: data.quantite_min || 0,
      unite: data.unite || 'u',
      valeur_unitaire: data.valeur_unitaire || 0,
      taxe: 'HT',
      emplacement: data.emplacement || 'LABO',
      fournisseur: data.fournisseur || '',
      notes: data.notes || '',
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    this.stockArticles.unshift(art);
    return art;
  }

  updateArticle(id: number, data: Partial<StockArticle>): boolean {
    const art = this.getArticle(id);
    if (!art) return false;
    Object.assign(art, data);
    return true;
  }

  deleteArticle(id: number): boolean {
    const idx = this.stockArticles.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.stockArticles.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Users
  getUserByIdentifiant(identifiant: string): User | undefined {
    return this.users.find((u) => u.identifiant.toLowerCase() === identifiant.toLowerCase());
  }

  getUser(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  getUsers(): User[] {
    return this.users;
  }

  addUser(data: Partial<User>): User {
    const u: User = {
      id: this.nextUserId++,
      identifiant: data.identifiant || '',
      mot_de_passe: data.mot_de_passe || 'password',
      role: data.role || 'utilisateur',
      nom_affiche: data.nom_affiche || data.identifiant || '',
      fonction: data.fonction || '',
      competences: data.competences || '',
      date_creation: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    this.users.push(u);
    return u;
  }

  updateUser(id: number, data: Partial<User>): boolean {
    const u = this.getUser(id);
    if (!u) return false;
    Object.assign(u, data);
    return true;
  }

  deleteUser(id: number): boolean {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.users.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Cahier
  getCahier(projetId: number): Cahier {
    let c = this.cahiers.find((x) => x.projet_id === projetId);
    if (!c) {
      c = {
        id: this.nextCahierId++,
        projet_id: projetId,
        categorie: '',
        contexte: '',
        objectifs: '',
        contraintes: '',
        dates_info: '',
        budget: '',
        ressources: '',
        risques: '',
        criteres_reussite: '',
        date_maj: new Date().toISOString().replace('T', ' ').substring(0, 19),
        fonctions: [],
        specs_techniques: [],
      };
      this.cahiers.push(c);
    }
    return c;
  }

  updateCahier(projetId: number, data: Partial<Cahier>): Cahier {
    const c = this.getCahier(projetId);
    Object.assign(c, data, { date_maj: new Date().toISOString().replace('T', ' ').substring(0, 19) });
    return c;
  }
}

export const db = new DataStore();
