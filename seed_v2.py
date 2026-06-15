"""
StudyHub — Production Database Seed v2
Scales to ~1,000 users with realistic posts, comments, and engagement.

Usage:
    python seed_v2.py               # seed (skip existing)
    python seed_v2.py --clear       # wipe first, then seed
    python seed_v2.py --users 200   # override user count

Requirements: Flask app context, all models importable, DB initialised.
"""

import os
import sys
import random
import argparse
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from extensions import db
from models import (
    User, StudentProfile, OnboardingDetails,
    Post, Comment, Thread, ThreadMember, ThreadMessage,
    PostReaction, Connection, Bookmark,
    PostFollow, PostView, Badge, UserBadge,
    ReputationHistory, UserActivity,
    StudyBuddyRequest, StudyBuddyMatch,
    CommentLike, CommentHelpfulMark, Notification,
)

# ─────────────────────────── COMMIT BATCH SIZE ───────────────────────────────
BATCH = 100   # flush / commit every N records in tight loops


# ══════════════════════════════════════════════════════════════════════════════
#  REFERENCE DATA
# ══════════════════════════════════════════════════════════════════════════════

FIRST_NAMES = [
    "Adaeze", "Ahmed", "Aisha", "Alex", "Amara", "Amina", "Andrew", "Blessing",
    "Brian", "Chidera", "Chidi", "Chioma", "Chloe", "Daniel", "David", "Ebuka",
    "Elena", "Emeka", "Emmanuel", "Esther", "Faith", "Favour", "Felix", "Funmi",
    "Grace", "Henry", "Ibrahim", "Ifeanyi", "Isaac", "James", "Jennifer", "Joel",
    "John", "Joy", "Kelechi", "Kevin", "Kola", "Laura", "Liam", "Linda",
    "Mark", "Mary", "Michael", "Michelle", "Miracle", "Moses", "Nathan",
    "Ngozi", "Nneka", "Nora", "Obinna", "Oghenekaro", "Olivia", "Opeyemi",
    "Patrick", "Paul", "Peace", "Peter", "Precious", "Rachel", "Richard",
    "Samuel", "Sandra", "Sarah", "Seun", "Simon", "Sophia", "Stephen",
    "Taiwo", "Temi", "Tope", "Tosin", "Tracy", "Uche", "Ugochi", "Victor",
    "Vincent", "Vivian", "Wale", "William", "Xavier", "Yemi", "Zara", "Zoe",
]

LAST_NAMES = [
    "Abara", "Adebayo", "Adeyemi", "Afolabi", "Agbo", "Ajayi", "Ajibade",
    "Akinola", "Akpan", "Alabi", "Aneke", "Asante", "Atanda", "Ayoola",
    "Babatunde", "Chukwu", "Dike", "Effiong", "Egbuna", "Eze",
    "Fashola", "Gbadebo", "Hassan", "Ibrahim", "Igwe", "Ihejirika",
    "Johnson", "Kalu", "Lawal", "Madu", "Mensah", "Mohammed", "Nwachukwu",
    "Nwosu", "Obasi", "Obi", "Odunbaku", "Ofor", "Ogbonna", "Ogundimu",
    "Ogunwale", "Okafor", "Okeke", "Okorie", "Okonkwo", "Okoro", "Oladele",
    "Oladipo", "Olawale", "Olayinka", "Olu", "Onuoha", "Orji", "Osahon",
    "Oshodi", "Otoide", "Owolabi", "Oyewole", "Peters", "Sanni", "Taiwo",
    "Thompson", "Uche", "Udoh", "Udom", "Umar", "Umeh", "Uzor", "Williams",
]

DEPARTMENTS = [
    "Computer Science", "Electrical Engineering", "Mechanical Engineering",
    "Civil Engineering", "Chemical Engineering", "Biology", "Chemistry",
    "Physics", "Mathematics", "Statistics", "English", "History",
    "Business Administration", "Economics", "Accounting", "Psychology",
    "Sociology", "Law", "Medicine", "Pharmacy",
]

CLASS_LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"]

LEARNING_STYLES = [
    "Visual learner – I learn best through diagrams and videos",
    "Auditory learner – I prefer lectures and discussions",
    "Reading/Writing learner – I take detailed notes and read textbooks",
    "Kinesthetic learner – I learn by doing practice problems",
    "Mixed learner – I combine multiple strategies depending on the topic",
]

SESSION_LENGTHS = ["30 minutes", "45 minutes", "60 minutes", "90 minutes", "2 hours"]

STUDY_PREFERENCES = ["video_call", "chat", "in_person", "async_messages"]

ALL_TAGS = [
    "Python", "JavaScript", "Java", "C++", "TypeScript", "React", "Vue",
    "Node.js", "Flask", "Django", "FastAPI", "SQL", "NoSQL", "MongoDB",
    "Data Structures", "Algorithms", "System Design", "OOP", "Functional Programming",
    "Calculus", "Linear Algebra", "Differential Equations", "Statistics",
    "Probability", "Discrete Mathematics", "Number Theory",
    "Classical Mechanics", "Thermodynamics", "Electromagnetism", "Quantum Physics",
    "Organic Chemistry", "Inorganic Chemistry", "Biochemistry", "Cell Biology",
    "Genetics", "Microbiology", "Anatomy", "Pharmacology",
    "Machine Learning", "Deep Learning", "NLP", "Computer Vision",
    "Data Science", "Data Analysis", "Pandas", "NumPy", "TensorFlow",
    "Web Development", "Mobile Development", "Android", "iOS", "Flutter",
    "Databases", "Networking", "Operating Systems", "Cloud Computing",
    "Cybersecurity", "DevOps", "Docker", "Git", "Linux",
    "Microeconomics", "Macroeconomics", "Financial Accounting", "Management",
    "English Literature", "Academic Writing", "Research Methods",
    "Circuit Analysis", "Signal Processing", "Embedded Systems",
    "Structural Analysis", "Fluid Mechanics", "Thermofluids",
]

REACTION_TYPES = ["like", "love", "helpful", "fire", "wow", "celebrate"]

BIO_TEMPLATES = [
    "{level} {dept} student passionate about {tag1} and {tag2}. Always looking to collaborate!",
    "Studying {dept} at {level}. Interests: {tag1}, {tag2}, {tag3}. DMs open for study groups.",
    "{dept} major | {level} | Love solving problems in {tag1}. Ask me about {tag2}.",
    "Future {dept_career}. Currently deep-diving into {tag1} and {tag2}.",
    "{level} student in {dept}. I tutor {tag1} and {tag2}. Coffee + code = productivity.",
    "Aspiring {dept_career} | {dept} {level} | Strong in {tag1}, learning {tag2}.",
    "Building skills in {tag1} one day at a time. {dept} – {level}.",
    "{dept} nerd. I spend weekends on {tag1} projects. Let's study {tag2} together!",
    "On a mission to master {tag1}. {dept} {level}. Open to peer study sessions.",
    "Curious {level} {dept} student. I write notes on {tag1} and share them here.",
]

DEPT_CAREERS = {
    "Computer Science": "Software Engineer",
    "Electrical Engineering": "Electrical Engineer",
    "Mechanical Engineering": "Mechanical Engineer",
    "Civil Engineering": "Civil Engineer",
    "Chemical Engineering": "Process Engineer",
    "Biology": "Biologist",
    "Chemistry": "Chemist",
    "Physics": "Physicist",
    "Mathematics": "Mathematician",
    "Statistics": "Data Analyst",
    "English": "Writer",
    "History": "Historian",
    "Business Administration": "Business Leader",
    "Economics": "Economist",
    "Accounting": "Chartered Accountant",
    "Psychology": "Psychologist",
    "Sociology": "Social Researcher",
    "Law": "Lawyer",
    "Medicine": "Medical Doctor",
    "Pharmacy": "Pharmacist",
}

BOOKMARK_FOLDERS = ["Saved", "Exam Prep", "Projects", "Must Review", "Shared Resources", "Favourites"]


# ══════════════════════════════════════════════════════════════════════════════
#  RICH POST CATALOGUE  (type, dept-cluster, title, body, tags, resources)
# ══════════════════════════════════════════════════════════════════════════════

# Each entry: (title, body, post_type, tag_pool, resources)
POST_CATALOGUE = [
    # ── COMPUTER SCIENCE / PROGRAMMING ──────────────────────────────────────
    (
        "How does Big-O notation actually work in practice?",
        (
            "I understand the theoretical definition of Big-O, but I struggle to apply it when "
            "analysing my own code. For example, I wrote a nested loop that iterates over an n×n "
            "matrix and I assumed it was O(n²), but my friend said the 'real' complexity also "
            "depends on the operations inside. Could someone walk me through how to properly count "
            "steps and simplify to Big-O? Any visuals or worked examples would really help."
        ),
        "question",
        ["Algorithms", "Data Structures", "Python", "C++"],
        [
            {"url": "https://www.khanacademy.org/computing/computer-science/algorithms", "type": "link",
             "filename": "Khan Academy – Algorithms"},
            {"url": "https://www.youtube.com/watch?v=v4cd1O4zkGw", "type": "link",
             "filename": "HackerRank – Big O Notation video"},
        ],
        "Computer Science",
    ),
    (
        "Best way to understand recursion — I keep getting stack overflows",
        (
            "Every time I try to write a recursive function I either get infinite recursion or my "
            "base cases are wrong. I know the concept in theory: a function calls itself with a "
            "smaller input until it hits the base case. But when I try to implement DFS on a binary "
            "tree, everything breaks. Can someone share a mental model or step-by-step approach they "
            "use to design recursive solutions from scratch?"
        ),
        "question",
        ["Algorithms", "Data Structures", "Python", "Java"],
        [
            {"url": "https://www.youtube.com/watch?v=ngCos392W4w", "type": "link",
             "filename": "Computerphile – Recursion explained"},
        ],
        "Computer Science",
    ),
    (
        "REST vs GraphQL — when should I actually choose GraphQL?",
        (
            "I've been building REST APIs for two years and I'm evaluating GraphQL for a new project "
            "that has a complex frontend with many data requirements. I've read the official docs but "
            "I'm not sure the overhead is worth it for a team of two. Has anyone made the switch? "
            "What were your pain points? When does the flexibility genuinely outweigh the complexity?"
        ),
        "discussion",
        ["Web Development", "Node.js", "Flask", "System Design"],
        [
            {"url": "https://graphql.org/learn/", "type": "link", "filename": "Official GraphQL Docs"},
            {"url": "https://www.howtographql.com/", "type": "link", "filename": "How to GraphQL – Free Tutorial"},
        ],
        "Computer Science",
    ),
    (
        "My linked-list implementation in Python keeps losing nodes",
        (
            "I'm implementing a doubly-linked list from scratch and my `delete_node` method seems to "
            "corrupt the list after deletion. I've traced through the pointer reassignments manually "
            "and can't spot the bug. I'll paste the method below — can someone help me see what I'm "
            "missing?\n\n"
            "```python\ndef delete_node(self, node):\n    prev = node.prev\n    nxt = node.next\n"
            "    if prev: prev.next = nxt\n    if nxt: nxt.prev = nxt  # bug somewhere here?\n```"
        ),
        "problem",
        ["Data Structures", "Python", "Algorithms"],
        [],
        "Computer Science",
    ),
    (
        "📚 Resource: MIT 6.006 Introduction to Algorithms — full lecture series (free)",
        (
            "Just finished watching all the MIT 6.006 lectures on YouTube and this is genuinely the "
            "best free algorithms course I've ever seen. Professor Demaine and Professor Devadas cover "
            "everything from hashing to dynamic programming with rigorous proofs and clear examples. "
            "Perfect if you're preparing for technical interviews or just want a solid foundation.\n\n"
            "Full playlist is on MIT OpenCourseWare. Lecture notes + problem sets are free to download."
        ),
        "resource",
        ["Algorithms", "Data Structures", "Python"],
        [
            {"url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/", "type": "link",
             "filename": "MIT 6.006 – Introduction to Algorithms (OCW)"},
            {"url": "https://www.youtube.com/playlist?list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb", "type": "link",
             "filename": "YouTube playlist – MIT 6.006"},
        ],
        "Computer Science",
    ),
    (
        "Understanding database indexing — when do indexes hurt performance?",
        (
            "I've been told to 'always index your foreign keys' but I've also read that too many "
            "indexes slow down writes. I'm building a social app with high write throughput on the "
            "posts table and I'm not sure how many indexes are too many. Can someone explain the "
            "trade-off clearly? How do I decide what to index?"
        ),
        "question",
        ["Databases", "SQL", "System Design"],
        [
            {"url": "https://use-the-index-luke.com/", "type": "link",
             "filename": "Use The Index, Luke – free SQL indexing guide"},
        ],
        "Computer Science",
    ),
    (
        "How I went from zero to deploying my first Flask app in 30 days",
        (
            "Six months ago I could barely write a for-loop. After 30 days of consistent practice "
            "following this roadmap, I deployed a fully-functional REST API with user auth, a "
            "PostgreSQL database, and CI/CD on Render. Sharing my exact schedule and the resources "
            "I used in case it helps anyone starting out. Feel free to ask questions!"
        ),
        "discussion",
        ["Python", "Flask", "Databases", "Web Development", "DevOps"],
        [
            {"url": "https://flask.palletsprojects.com/en/stable/", "type": "link",
             "filename": "Flask Official Documentation"},
            {"url": "https://www.freecodecamp.org/news/how-to-build-a-flask-api/", "type": "link",
             "filename": "freeCodeCamp – Build a Flask API"},
        ],
        "Computer Science",
    ),
    (
        "Docker crash course — everything I wish I knew as a beginner",
        (
            "After months of confusion, I finally feel comfortable with Docker. Here are the core "
            "concepts that clicked for me: images vs containers, Dockerfile instructions, "
            "docker-compose for multi-service apps, volume mounting for dev workflow, and how to "
            "push to Docker Hub. Resources attached — start with the official Play With Docker lab."
        ),
        "resource",
        ["Docker", "DevOps", "Linux", "Cloud Computing"],
        [
            {"url": "https://labs.play-with-docker.com/", "type": "link",
             "filename": "Play With Docker – interactive lab"},
            {"url": "https://docs.docker.com/get-started/", "type": "link",
             "filename": "Official Docker Getting Started Guide"},
        ],
        "Computer Science",
    ),
    (
        "Git merge vs rebase — what actually happens under the hood?",
        (
            "I use `git merge` every day but I always get confused during rebases. I know rebase "
            "'rewrites history' but I don't have a clear mental picture of what that means for the "
            "commit graph. Can someone draw out (even in ASCII) what happens to the commit tree when "
            "you run `git rebase main` on a feature branch?"
        ),
        "question",
        ["Git", "DevOps"],
        [
            {"url": "https://www.atlassian.com/git/tutorials/merging-vs-rebasing", "type": "link",
             "filename": "Atlassian – Merging vs Rebasing"},
        ],
        "Computer Science",
    ),
    (
        "My SQL query returns duplicates even with DISTINCT — here's my schema",
        (
            "I have a `JOIN` across three tables and despite adding `SELECT DISTINCT`, I still get "
            "duplicate rows in my result set. I suspect it's related to a many-to-many relationship "
            "but I can't isolate it. Sharing my schema below — any SQL experts who can spot the issue?"
        ),
        "problem",
        ["SQL", "Databases"],
        [],
        "Computer Science",
    ),

    # ── MATHEMATICS ─────────────────────────────────────────────────────────
    (
        "Why does the chain rule feel so unintuitive and how can I visualise it?",
        (
            "I can mechanically apply the chain rule — multiply outer derivative by inner derivative "
            "— but I have no feel for *why* it works. I've tried reading the formal proof but it "
            "doesn't give me intuition. 3Blue1Brown's essence of calculus series was helpful but "
            "I still can't reconstruct the reasoning on my own. Any alternative explanations?"
        ),
        "question",
        ["Calculus", "Mathematics"],
        [
            {"url": "https://www.youtube.com/watch?v=YG15m2VwSjA", "type": "link",
             "filename": "3Blue1Brown – Chain Rule (Essence of Calculus)"},
            {"url": "https://tutorial.math.lamar.edu/classes/calcI/ChainRule.aspx", "type": "link",
             "filename": "Paul's Online Math Notes – Chain Rule"},
        ],
        "Mathematics",
    ),
    (
        "Linear algebra resources beyond the standard textbook",
        (
            "I've worked through Gilbert Strang's Introduction to Linear Algebra (a fantastic book) "
            "but I want something that bridges to machine learning applications. Looking for "
            "resources that connect eigenvalues/eigenvectors to PCA, and null space to solving "
            "underdetermined systems. Any recommendations for the 'applied' side of linear algebra?"
        ),
        "resource",
        ["Linear Algebra", "Mathematics", "Machine Learning", "Data Science"],
        [
            {"url": "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/", "type": "link",
             "filename": "MIT 18.06 – Linear Algebra (Strang, OCW)"},
            {"url": "https://www.deeplearningbook.org/contents/linear_algebra.html", "type": "link",
             "filename": "Deep Learning Book – Chapter 2: Linear Algebra"},
            {"url": "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab", "type": "link",
             "filename": "3Blue1Brown – Essence of Linear Algebra (YouTube)"},
        ],
        "Mathematics",
    ),
    (
        "Stuck on proof by mathematical induction — step 2 never makes sense",
        (
            "I can do the base case fine. But in the inductive step, I always get confused about "
            "what I'm allowed to assume. My lecturer says 'assume P(k) is true, then prove P(k+1)' "
            "but that feels circular. Can someone explain the logical justification for why this is "
            "valid? Preferably with an example like proving sum of first n integers."
        ),
        "question",
        ["Discrete Mathematics", "Mathematics", "Number Theory"],
        [
            {"url": "https://www.youtube.com/watch?v=wblW_M_HVQ8", "type": "link",
             "filename": "Professor Leonard – Mathematical Induction"},
        ],
        "Mathematics",
    ),
    (
        "How to solve differential equations — a practical study guide",
        (
            "After struggling with ODEs for a semester, here's the framework that finally made "
            "everything click for me. I organise by equation type: (1) separable — separate and "
            "integrate, (2) linear first-order — integrating factor method, (3) second-order "
            "homogeneous — characteristic equation. I've attached a PDF cheatsheet and links to "
            "the best worked examples I found."
        ),
        "resource",
        ["Differential Equations", "Calculus", "Mathematics"],
        [
            {"url": "https://tutorial.math.lamar.edu/classes/de/de.aspx", "type": "link",
             "filename": "Paul's Online Math Notes – Differential Equations"},
            {"url": "https://www.youtube.com/playlist?list=PLDesaqWTN6EQ2J4vgsN1HyBeRADEh4Cw-", "type": "link",
             "filename": "Professor Leonard – Differential Equations (YouTube)"},
        ],
        "Mathematics",
    ),
    (
        "Probability question: why is P(A|B) ≠ P(B|A) and when does it matter?",
        (
            "I always confuse conditional probability with its converse. I understand they're "
            "different mathematically, but I keep making errors in exam questions that involve "
            "Bayes' theorem. Can anyone give me a real-world example (not the standard medical "
            "test one) that makes the asymmetry really obvious?"
        ),
        "question",
        ["Probability", "Statistics", "Mathematics"],
        [
            {"url": "https://www.khanacademy.org/math/statistics-probability/probability-library/conditional-probability-independence/a/conditional-probability-article", "type": "link",
             "filename": "Khan Academy – Conditional Probability"},
        ],
        "Mathematics",
    ),

    # ── ELECTRICAL / MECHANICAL ENGINEERING ─────────────────────────────────
    (
        "How to approach circuit analysis when you have both dependent and independent sources",
        (
            "In our circuits lab we keep getting assignments with dependent voltage/current sources "
            "and I find applying node voltage or mesh current analysis much harder when dependent "
            "sources are present. The constraint equations trip me up. Can anyone walk through the "
            "methodology systematically?"
        ),
        "question",
        ["Circuit Analysis", "Electrical Engineering", "Physics"],
        [
            {"url": "https://www.allaboutcircuits.com/textbook/direct-current/chpt-10/mesh-current-method/", "type": "link",
             "filename": "All About Circuits – Mesh Current Method"},
        ],
        "Electrical Engineering",
    ),
    (
        "Signal Processing study group — sharing resources for our upcoming test",
        (
            "For everyone preparing for the EEE 304 Signal Processing exam, I've compiled "
            "the best free resources below. Focus areas: Fourier Transform pairs (memorise the "
            "common ones), Z-transform for discrete systems, and filter design (Butterworth vs "
            "Chebyshev). Good luck to everyone!"
        ),
        "resource",
        ["Signal Processing", "Electrical Engineering", "Mathematics"],
        [
            {"url": "https://www.dspguide.com/", "type": "link",
             "filename": "The Scientist and Engineer's Guide to DSP – free online"},
            {"url": "https://www.youtube.com/c/iainexplains", "type": "link",
             "filename": "Iain Explains Signals, Systems & Digital Comms (YouTube)"},
        ],
        "Electrical Engineering",
    ),
    (
        "Thermodynamics — I keep failing problems about entropy. What am I missing?",
        (
            "I get the first law of thermodynamics fine (energy conservation) but the second law "
            "and entropy genuinely confuse me. My main problems: (1) I don't know when to use "
            "dS = dQ/T vs the full entropy equation, (2) I can't tell if a process is reversible "
            "or irreversible from a problem statement alone. Any pointers?"
        ),
        "question",
        ["Thermodynamics", "Physics", "Mechanical Engineering"],
        [
            {"url": "https://ocw.mit.edu/courses/2-006-thermal-fluids-engineering-ii-spring-2008/", "type": "link",
             "filename": "MIT OCW – Thermal Fluids Engineering II"},
        ],
        "Mechanical Engineering",
    ),
    (
        "Free Body Diagram mastery: the one skill that unlocks all of statics",
        (
            "In four years of engineering I've tutored over 50 students and the single biggest "
            "reason students fail statics is poor free body diagram technique. Here's my step-by-step "
            "guide: isolate the body, identify all external forces (applied, normal, friction, weight), "
            "assign coordinate system, write equilibrium equations. Worked examples attached."
        ),
        "resource",
        ["Structural Analysis", "Mechanical Engineering", "Physics"],
        [
            {"url": "https://www.engineeringmechanics.org/", "type": "link",
             "filename": "Engineering Mechanics – Free FBD resources"},
            {"url": "https://ocw.mit.edu/courses/2-001-mechanics-materials-i-fall-2006/", "type": "link",
             "filename": "MIT OCW – Mechanics & Materials I"},
        ],
        "Mechanical Engineering",
    ),

    # ── BIOLOGY / CHEMISTRY ─────────────────────────────────────────────────
    (
        "Memorising metabolic pathways — strategies that actually work",
        (
            "Glycolysis, Krebs cycle, electron transport chain — I keep mixing up the steps, "
            "intermediates, and energy yields. My lecturer says 'understand, don't memorise' but "
            "in the exam they ask for specific intermediate names. What strategies helped you "
            "retain all these pathways? Mnemonics? Drawing from memory? Anki?"
        ),
        "question",
        ["Biochemistry", "Biology", "Cell Biology"],
        [
            {"url": "https://www.khanacademy.org/science/ap-biology/cellular-energetics", "type": "link",
             "filename": "Khan Academy – Cellular Energetics"},
            {"url": "https://ankiweb.net/shared/decks/biochemistry", "type": "link",
             "filename": "Anki – Shared Biochemistry Decks"},
        ],
        "Biology",
    ),
    (
        "How does CRISPR-Cas9 actually cut DNA — step by step",
        (
            "I've read the Wikipedia article three times and I still don't understand the mechanics. "
            "Specifically: how does the guide RNA find the target sequence so quickly in a whole "
            "genome? And why does the PAM sequence matter — couldn't Cas9 cut anywhere the guide "
            "RNA matches? I'm preparing a seminar presentation and want to explain this clearly."
        ),
        "question",
        ["Genetics", "Biochemistry", "Biology"],
        [
            {"url": "https://www.youtube.com/watch?v=2pp17E4E-O8", "type": "link",
             "filename": "Broad Institute – CRISPR explained"},
            {"url": "https://www.nature.com/articles/d41586-019-02736-7", "type": "link",
             "filename": "Nature – How CRISPR works"},
        ],
        "Biology",
    ),
    (
        "Organic chemistry reaction mechanisms — my complete cheat sheet",
        (
            "After two semesters of organic chemistry I've consolidated all the major reaction "
            "mechanisms into one reference sheet. Covered: nucleophilic substitution (SN1, SN2), "
            "elimination (E1, E2), addition reactions, oxidation/reduction, and aromatic chemistry. "
            "Use this alongside Master Organic Chemistry for the best results."
        ),
        "resource",
        ["Organic Chemistry", "Chemistry"],
        [
            {"url": "https://www.masterorganicchemistry.com/", "type": "link",
             "filename": "Master Organic Chemistry – reaction guides"},
            {"url": "https://www.khanacademy.org/science/organic-chemistry", "type": "link",
             "filename": "Khan Academy – Organic Chemistry"},
        ],
        "Chemistry",
    ),
    (
        "Understanding pH calculations — why do I always get the sign wrong?",
        (
            "I know pH = -log[H+] but I consistently make errors when dealing with weak acids, "
            "buffers, and Ka expressions. I think my core problem is with ICE tables — I'm not "
            "sure when to use the approximation that x << initial concentration. Can someone "
            "show me a decision framework for choosing when the approximation is valid?"
        ),
        "question",
        ["Chemistry", "Inorganic Chemistry"],
        [
            {"url": "https://www.khanacademy.org/science/chemistry/acid-base-equilibrium", "type": "link",
             "filename": "Khan Academy – Acid-Base Equilibrium"},
        ],
        "Chemistry",
    ),
    (
        "Microbiology lab report tips — getting full marks on discussion sections",
        (
            "After TAing first-year microbiology for two years, here are the most common reasons "
            "students lose marks on discussion sections: (1) not linking observations to theory, "
            "(2) ignoring sources of error, (3) vague conclusions without data references. I've "
            "written a template structure that gets consistent high marks."
        ),
        "resource",
        ["Microbiology", "Biology"],
        [],
        "Biology",
    ),

    # ── ECONOMICS / BUSINESS ────────────────────────────────────────────────
    (
        "Micro vs Macro economics — how are they actually connected?",
        (
            "I'm taking both courses simultaneously and they feel like different subjects. "
            "Microeconomics talks about individual agents and markets; macroeconomics talks about "
            "GDP, inflation, and monetary policy. But surely they're connected? Can someone explain "
            "the bridge between them — specifically how aggregate demand in macro relates to "
            "individual demand curves in micro?"
        ),
        "question",
        ["Microeconomics", "Macroeconomics", "Economics"],
        [
            {"url": "https://www.khanacademy.org/economics-finance-domain/macroeconomics", "type": "link",
             "filename": "Khan Academy – Macroeconomics"},
        ],
        "Economics",
    ),
    (
        "Financial accounting: understanding debits and credits once and for all",
        (
            "After three weeks of studying I finally cracked the debit/credit system and I want "
            "to share my mental model. The key insight: debits and credits don't mean 'increase' "
            "and 'decrease' — they describe which side of the T-account you're recording on. "
            "Assets and expenses increase with debits; liabilities, equity, and revenue increase "
            "with credits. Once this clicked, everything else followed."
        ),
        "discussion",
        ["Financial Accounting", "Accounting", "Business Administration"],
        [
            {"url": "https://www.accountingcoach.com/debits-and-credits/explanation", "type": "link",
             "filename": "AccountingCoach – Debits & Credits Explained"},
        ],
        "Accounting",
    ),
    (
        "Game theory basics — the Nash Equilibrium explained without jargon",
        (
            "I struggled with Nash Equilibrium until I stopped thinking mathematically and started "
            "thinking about incentives. Here's a plain-English explanation: a Nash Equilibrium is "
            "any outcome where no player can improve their position by changing only their own "
            "strategy, assuming others don't change theirs. The prisoner's dilemma is the classic "
            "example. Resources below for going deeper."
        ),
        "resource",
        ["Microeconomics", "Economics", "Mathematics"],
        [
            {"url": "https://www.youtube.com/watch?v=M3oWYHYoBvk", "type": "link",
             "filename": "CrashCourse – Game Theory"},
            {"url": "https://ncase.me/trust/", "type": "link",
             "filename": "The Evolution of Trust – interactive game theory explainer"},
        ],
        "Economics",
    ),

    # ── MACHINE LEARNING / DATA SCIENCE ─────────────────────────────────────
    (
        "How to choose between gradient descent variants — SGD, Adam, RMSProp",
        (
            "I'm training a neural network for a classification task and I see dramatically "
            "different training curves when I swap optimisers. I know Adam is generally recommended "
            "but I've heard it can generalise worse than SGD with momentum. Can someone explain the "
            "intuition behind each variant and when one is preferred?"
        ),
        "question",
        ["Machine Learning", "Deep Learning", "Python", "Data Science"],
        [
            {"url": "https://ruder.io/optimizing-gradient-descent/", "type": "link",
             "filename": "Sebastian Ruder – An overview of gradient descent optimisation algorithms"},
            {"url": "https://www.deeplearningbook.org/", "type": "link",
             "filename": "Deep Learning Book – Goodfellow et al. (free online)"},
        ],
        "Computer Science",
    ),
    (
        "Overfitting — what is it really and how do I know when it's happening?",
        (
            "I keep hearing 'your model is overfitting' but I want to deeply understand what that "
            "means in practice. My training accuracy is 97% but validation accuracy is 73%. I've "
            "added dropout and it helped a little. What other regularisation techniques should I "
            "try? And how do I know when I've *under*-regularised vs *over*-regularised?"
        ),
        "question",
        ["Machine Learning", "Deep Learning", "Data Science"],
        [
            {"url": "https://www.youtube.com/watch?v=u73PU6Qwl1I", "type": "link",
             "filename": "StatQuest – Overfitting explained (YouTube)"},
        ],
        "Computer Science",
    ),
    (
        "Complete roadmap for learning data science from zero — 2024 edition",
        (
            "I've mentored over 30 students into data science roles and here's the exact roadmap "
            "I recommend: (1) Python basics + NumPy + Pandas, (2) Statistics + Probability, "
            "(3) Machine Learning with scikit-learn, (4) One deep learning framework (PyTorch), "
            "(5) SQL + databases, (6) End-to-end project + deployment. Timeline: ~12 months "
            "part-time. Resources below are all free."
        ),
        "resource",
        ["Data Science", "Python", "Machine Learning", "Statistics"],
        [
            {"url": "https://www.kaggle.com/learn", "type": "link",
             "filename": "Kaggle Learn – Free Data Science Courses"},
            {"url": "https://www.fast.ai/", "type": "link",
             "filename": "Fast.ai – Practical Deep Learning for Coders"},
            {"url": "https://d2l.ai/", "type": "link",
             "filename": "Dive into Deep Learning – interactive textbook"},
        ],
        "Computer Science",
    ),

    # ── PHYSICS ─────────────────────────────────────────────────────────────
    (
        "Quantum mechanics — what does 'the wave function collapses' actually mean?",
        (
            "I've taken an introductory QM course and I understand the Schrödinger equation "
            "mathematically, but the measurement problem confuses me. When we say the wave function "
            "collapses upon observation, what physically happens? My professor says this is still "
            "an open problem in physics but I want to understand the different interpretations "
            "(Copenhagen, many-worlds, pilot-wave theory)."
        ),
        "question",
        ["Quantum Physics", "Physics"],
        [
            {"url": "https://www.youtube.com/watch?v=kTXTPe3wahc", "type": "link",
             "filename": "PBS Space Time – Quantum Interpretations"},
            {"url": "https://plato.stanford.edu/entries/qm-manyworlds/", "type": "link",
             "filename": "Stanford Encyclopedia – Many-Worlds Interpretation"},
        ],
        "Physics",
    ),
    (
        "Classical mechanics problem set — I can't get the Lagrangian method right",
        (
            "In my Analytical Mechanics course we've moved from Newtonian to Lagrangian mechanics "
            "and I'm struggling with the generalised coordinates. Specifically, for a double pendulum, "
            "I'm not sure how to correctly express the kinetic energy in terms of θ₁ and θ₂. "
            "I've set up the problem but my equations of motion don't match the textbook solution."
        ),
        "problem",
        ["Classical Mechanics", "Physics", "Calculus"],
        [
            {"url": "https://www.youtube.com/watch?v=KpLno70oYHE", "type": "link",
             "filename": "Shankar – Fundamentals of Physics (Yale OCW)"},
        ],
        "Physics",
    ),
    (
        "Understanding Maxwell's equations without advanced vector calculus",
        (
            "I'm in my second year and we've just been introduced to Maxwell's equations but I "
            "don't have the vector calculus background yet (div, curl, etc.). My lecturer says "
            "to just accept them as axioms for now, but I want to understand what they're saying "
            "physically. Is there a good conceptual explanation before I take the maths?"
        ),
        "question",
        ["Electromagnetism", "Physics", "Mathematics"],
        [
            {"url": "https://www.youtube.com/watch?v=hJD8ywGrXks", "type": "link",
             "filename": "Veritasium – How Electricity Actually Works"},
            {"url": "https://www.feynmanlectures.caltech.edu/II_toc.html", "type": "link",
             "filename": "Feynman Lectures on Physics – Vol. II (free online)"},
        ],
        "Physics",
    ),

    # ── STUDY SKILLS / GENERAL ───────────────────────────────────────────────
    (
        "The Feynman Technique is overrated — here's what actually works for me",
        (
            "You've probably heard 'explain it simply to understand it deeply.' I tried the "
            "Feynman Technique for a semester and found it only works for concepts, not for "
            "procedural skills like derivations. What actually moved the needle for me: "
            "spaced repetition with Anki, interleaved practice (mixing problem types), and "
            "retrieval practice (testing yourself before reviewing). Happy to elaborate."
        ),
        "discussion",
        ["Python"],
        [
            {"url": "https://apps.ankiweb.net/", "type": "link",
             "filename": "Anki – Spaced Repetition Software (free)"},
            {"url": "https://www.learningscientists.org/downloadable-materials", "type": "link",
             "filename": "Learning Scientists – Evidence-Based Study Strategies"},
        ],
        "Computer Science",
    ),
    (
        "How I manage studying across 6 courses without burning out",
        (
            "I'm a 400-level student carrying 6 units this semester and I've developed a system "
            "that keeps me sane. Core principles: (1) weekly planning on Sunday nights, "
            "(2) themed study days (math Mondays, programming Tuesdays, etc.), "
            "(3) Pomodoro 25/5 for focused sessions, (4) mandatory offline Saturdays. "
            "The system isn't perfect but I haven't missed a deadline in two semesters."
        ),
        "discussion",
        ["Python"],
        [
            {"url": "https://todoist.com/", "type": "link", "filename": "Todoist – Task management"},
            {"url": "https://www.notion.so/", "type": "link", "filename": "Notion – Note-taking and planning"},
        ],
        "Computer Science",
    ),
    (
        "Best free tools every university student should know about",
        (
            "After four years I've assembled the ultimate free toolkit: Zotero (reference manager), "
            "Anki (flashcards), Wolfram Alpha (computation), Desmos (graphing), Overleaf (LaTeX), "
            "Grammarly (writing), Sci-Hub (papers), Google Scholar (finding papers), Notion "
            "(notes), and of course this platform. All free, all essential."
        ),
        "resource",
        ["Python", "Data Science"],
        [
            {"url": "https://www.zotero.org/", "type": "link", "filename": "Zotero – Free reference manager"},
            {"url": "https://www.wolframalpha.com/", "type": "link", "filename": "Wolfram Alpha – Computation"},
            {"url": "https://www.desmos.com/", "type": "link", "filename": "Desmos – Graphing calculator"},
            {"url": "https://www.overleaf.com/", "type": "link", "filename": "Overleaf – LaTeX editor"},
        ],
        "Computer Science",
    ),
    (
        "Preparing for final exams — a 4-week countdown strategy",
        (
            "With finals 4 weeks away, here's the schedule I follow every semester: "
            "Week 4: identify weak areas per course, make topic list. "
            "Week 3: content review using active recall (no highlighting!). "
            "Week 2: past papers under timed conditions. "
            "Week 1: targeted gap-filling + rest. The single biggest mistake I see is starting "
            "past papers too late. Treat them as practice from week 3."
        ),
        "discussion",
        ["Mathematics", "Physics"],
        [],
        "Computer Science",
    ),
    (
        "Networking tip for students: how to connect with academics on LinkedIn",
        (
            "Cold-messaging professors and researchers on LinkedIn has led to two internships and a "
            "research assistant position for me. The formula: (1) personalise with something specific "
            "from their work, (2) say exactly what you want (a 30-min call, a review of your work, "
            "etc.), (3) make it easy for them to say yes. Posting my template below."
        ),
        "resource",
        ["Python"],
        [],
        "Business Administration",
    ),

    # ── MEDICINE / PHARMACY ──────────────────────────────────────────────────
    (
        "How to read and interpret a pharmacology research paper as a second-year student",
        (
            "Our pharmacology lecturer recommended we read primary papers but nobody taught us how. "
            "Here's the framework I use: (1) Read abstract → decide if the study is relevant, "
            "(2) Skip to results and figures first, (3) Return to methods to assess validity, "
            "(4) Read discussion critically — identify author biases. Key journals: NEJM, Lancet, "
            "JAMA, BJCP."
        ),
        "resource",
        ["Pharmacology", "Medicine"],
        [
            {"url": "https://www.nejm.org/", "type": "link", "filename": "New England Journal of Medicine"},
            {"url": "https://www.thelancet.com/", "type": "link", "filename": "The Lancet"},
            {"url": "https://pubmed.ncbi.nlm.nih.gov/", "type": "link", "filename": "PubMed – free paper search"},
        ],
        "Pharmacy",
    ),
    (
        "Anatomy mnemonics that actually stick — cranial nerves and more",
        (
            "My anatomy professor says mnemonics are a crutch, but I passed my cranial nerves "
            "exam with a distinction using them. Sharing the ones that stuck: for the 12 cranial "
            "nerves, I use 'On Old Olympus Towering Tops A Finn And German Viewed Some Hops.' "
            "Also including mnemonics for the brachial plexus, carpals, and arterial branches."
        ),
        "resource",
        ["Anatomy", "Medicine", "Biology"],
        [
            {"url": "https://www.kenhub.com/en/library/anatomy/cranial-nerves", "type": "link",
             "filename": "Kenhub – Cranial Nerves Overview"},
        ],
        "Medicine",
    ),
]

# ── POST TYPE DISTRIBUTION (weights) ──────────────────────────────────────────
POST_TYPES = ["question", "discussion", "problem", "resource", "announcement"]
POST_TYPE_WEIGHTS = [30, 25, 20, 20, 5]

# ── CONTEXTUAL COMMENT POOLS ──────────────────────────────────────────────────
COMMENTS_BY_TYPE = {
    "question": [
        "Great question — this confused me too when I first started. The key insight is {insight}.",
        "I ran into the exact same problem last semester. What finally worked for me was breaking it into smaller pieces first.",
        "Have you checked the official documentation? There's a section that addresses this directly.",
        "I'd recommend starting with the simple case first and working up to the general one.",
        "This is a classic conceptual gap. The short answer is that {insight}, but the full picture takes more unpacking.",
        "Try drawing it out on paper — visualising the steps often makes the logic click in a way reading doesn't.",
        "Your intuition is mostly right but you're missing one constraint. Consider what happens when the input is zero.",
        "I covered this in a study group last week. Happy to share our notes if that would help.",
        "The textbook explanation for this is notoriously bad. A much better resource is the one linked in my profile.",
        "Good question to post — I've been wondering about this myself. Watching for answers.",
        "The trick is to work backwards from the result you want. Start with the target, then ask what conditions get you there.",
        "Could you share more context about what you've already tried? That would help give a more targeted answer.",
        "This is covered well in Chapter 4 of the standard textbook — the end-of-chapter problems are very relevant.",
        "I spent a whole afternoon on this exact issue. The answer is simpler than it seems — don't overthink it.",
        "Interesting framing of the problem. I'd approach it differently — start with the constraints rather than the equation.",
    ],
    "discussion": [
        "Really interesting perspective. I'd push back slightly on one point though — {insight}.",
        "I had the opposite experience, honestly. My journey went in the reverse direction and I found it more effective.",
        "This matches what I've read in the research literature on learning strategies. Evidence-based stuff.",
        "Strong agree on the main point. The one thing I'd add is that context matters a lot too.",
        "I've tried both approaches you mention and found a hybrid works best for me personally.",
        "This is a debate worth having. My two cents: the answer depends on your end goal.",
        "Thanks for sharing this — it's making me rethink my own approach to the problem.",
        "I'd love to see data on this. Has anyone found empirical evidence comparing the two methods?",
        "This is exactly the kind of practical advice that lectures never give you. Appreciate it.",
        "Question for you: does this approach still hold when you're under exam pressure? I find I revert to old habits.",
        "I shared this post in our course group chat — lots of people feeling the same way.",
        "Totally agree about the time management aspect. I'd add that energy management matters just as much as time.",
        "Hot take: the traditional teaching model is what causes these problems in the first place.",
        "For what it's worth, my mentor gave me the same advice when I was struggling in second year.",
    ],
    "problem": [
        "I can see the bug — in line 3 you're reassigning the wrong variable. Should be `prev.next = nxt`, not `nxt.prev = nxt`.",
        "This is a classic off-by-one error. Print the value of your iterator at each step to confirm.",
        "Your logic is correct but you're not handling the edge case where the input list is empty.",
        "Try adding a print statement before the crash to see exactly where the state breaks down.",
        "I had an identical bug last week. The issue is that you're mutating the data structure while iterating over it.",
        "This looks like a pointer aliasing issue. Try using a fresh reference variable instead of reusing the same one.",
        "Could you add the full error message and stack trace? That would make it much easier to diagnose.",
        "The issue is subtle — you're confusing the logical structure with the physical representation.",
        "Step through this with a tiny example (3 elements) by hand and you'll spot it immediately.",
        "Your approach is right. The implementation error is in how you update the boundary condition at the end.",
        "Debugging tip: isolate the failing case into the smallest possible reproducible example first.",
        "This is a synchronisation issue — the state hasn't been flushed when you're reading it back.",
        "Looks like you're missing a null check. Add a guard for the case where the node has no predecessor.",
    ],
    "resource": [
        "Thank you for posting this! I've been looking for a good resource on exactly this topic.",
        "Saving this immediately. The MIT OCW materials are genuinely top-tier.",
        "I've used this resource before — can confirm it's excellent. The worked examples are especially clear.",
        "Bookmarked. The first link is the best one for beginners; I'd suggest starting there.",
        "This is gold. Sharing with my entire study group right now.",
        "Great curation. I'd also add Paul's Online Notes as a companion resource — very complementary.",
        "I went through this course last semester and it changed how I approach the subject. Highly recommend.",
        "One thing to note: the YouTube series is better for building intuition; the textbook is better for problem practice.",
        "Thank you! The gap in free, high-quality resources for this topic is real. This fills it nicely.",
        "Just went through the first link — the quality is much better than I expected from a free resource.",
        "This deserves more upvotes. I spent weeks searching for something this organised.",
        "For anyone using Anki, you can find shared decks that map directly to this curriculum. Check ankiweb.net.",
        "The MIT OCW materials are dense but worth the effort. Budget twice as long as the stated reading time.",
    ],
    "announcement": [
        "Thanks for the heads up! Will keep this in mind.",
        "Appreciate the announcement. Is there a way to get notified when new sessions are added?",
        "Brilliant! Will you be recording the session for those who can't attend live?",
        "Looking forward to this. Can we submit questions in advance?",
        "This is exactly what our cohort needs. Count me in.",
        "Thank you for organising this! Please share any materials afterwards.",
        "Shared this with my department group chat — lots of interest.",
    ],
}

REPLY_TEMPLATES = [
    "@{username} Thanks, that actually makes a lot of sense now. One follow-up: {followup}",
    "@{username} Really helpful, appreciate it! I'll try that tonight.",
    "@{username} Interesting take — I hadn't considered that angle before.",
    "@{username} That's exactly the clarification I needed. You explained it better than my textbook.",
    "@{username} I disagree slightly — in my experience the edge cases trip you up more than the main logic.",
    "@{username} Great point. Did you find this approach scales well for larger inputs?",
    "@{username} Thanks for the resource link! Just checked it and it's very clear.",
    "@{username} I tried what you suggested and it worked! The issue was exactly what you described.",
    "@{username} This is so helpful, thank you. Saving this comment for future reference.",
    "@{username} That makes sense. How long did it take you to get comfortable with this approach?",
]

FOLLOWUP_FRAGMENTS = [
    "does this still apply in the edge case where the input is empty?",
    "would you approach it differently for larger datasets?",
    "is there a way to verify this without running the full test suite?",
    "does this change if we're working in a compiled vs interpreted language?",
    "what's the recommended pattern when you need to handle exceptions here too?",
    "is the complexity still the same after the optimisation you described?",
    "how would you modify this for a bidirectional case?",
]

THREAD_DESCRIPTIONS = [
    "Let's work through problem sets together and help each other fill knowledge gaps.",
    "A space for sharing resources, asking questions, and keeping each other accountable.",
    "Open to everyone studying this topic. Post questions, share discoveries, give feedback.",
    "Collaborative study group — all levels welcome. We go at the pace of the group.",
    "For the upcoming exam. Let's share past questions and solutions.",
    "Share your notes, ask for clarification, and stay motivated together.",
    "A focused group for deep-dives into this subject. Engagement expected!",
    "Weekly study sessions every Sunday evening. Resources pinned at the top.",
]

THREAD_MESSAGE_POOL = [
    "Just uploaded my notes from today's lecture — check the pinned resources.",
    "Who's planning to attempt problem 7 from last year's exam? Let's tackle it together.",
    "Found a great video that explains this way better than our textbook. Sharing the link.",
    "Can someone clarify what came up in the tutorial? I missed the last 10 minutes.",
    "Great session today everyone. Same time next week?",
    "I'm stuck on question 3 — has anyone worked through it yet?",
    "Quick reminder: assignment 2 is due at midnight on Friday.",
    "Does anyone have the lecturer's contact for office hours? I can't find it on the portal.",
    "Sharing my worked solutions — please cross-check yours and flag any differences.",
    "Just finished the past paper from 2021. Much harder than 2020. We need to prep thoroughly.",
    "The simulation exercise from chapter 5 is actually fun once you get the hang of it.",
    "For those who missed today: we covered sections 4.3 to 4.7. Key points in the pinned notes.",
    "Two weeks until finals. Should we do daily sessions from now?",
    "Has anyone found a good summary of the derivations we need to memorise?",
]

# ── INTRO / WELCOME POSTS ────────────────────────────────────────────────────
# Non-Nigerian names only. Realistic self-intro posts.
INTRO_FIRST_NAMES = [
    "Liam", "Emma", "Noah", "Olivia", "James", "Sophia", "Lucas", "Isabella",
    "Mason", "Mia", "Ethan", "Charlotte", "Logan", "Amelia", "Aiden", "Harper",
    "Sebastian", "Evelyn", "Jack", "Luna", "Owen", "Camila", "Daniel", "Aria",
    "Matthew", "Scarlett", "Henry", "Victoria", "Alexander", "Madison",
    "Rania", "Karim", "Youssef", "Leila", "Tariq", "Yasmin", "Omar", "Layla",
    "Andile", "Thandiwe", "Sipho", "Zanele", "Thabo", "Naledi", "Siyanda",
    "Mei", "Wei", "Jing", "Hana", "Yuki", "Sora", "Ren", "Aiko",
    "Carlos", "Maria", "Diego", "Valentina", "Mateo", "Santiago",
    "Priya", "Arjun", "Kavya", "Rohan", "Sneha", "Aditya", "Nisha",
    "Tom", "Sophie", "Harry", "Emily", "George", "Chloe", "Callum", "Isla",
    "Ivan", "Natasha", "Dmitri", "Katarina", "Alexei", "Anya",
]

INTRO_LAST_NAMES = [
    "Anderson", "Martin", "Thompson", "White", "Harris", "Clark", "Lewis",
    "Robinson", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott",
    "Torres", "Rivera", "Ramirez", "Morales", "Reyes", "Cruz", "Flores",
    "Patel", "Sharma", "Singh", "Kumar", "Gupta", "Mehta", "Joshi",
    "Kim", "Park", "Lee", "Choi", "Jung", "Yoon", "Lim", "Kwon",
    "Ahmed", "Hassan", "Ibrahim", "Khalid", "Rahman", "Malik", "Shah",
    "Dlamini", "Nkosi", "Molefe", "Khumalo", "Zulu", "Mokoena", "Sithole",
    "Nakamura", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Kobayashi",
    "Muller", "Schmidt", "Weber", "Meyer", "Wagner", "Becker", "Schulz",
    "Dubois", "Laurent", "Bernard", "Moreau", "Simon", "Lefebvre",
    "Campbell", "Mitchell", "Stewart", "Morrison", "MacDonald", "Reid",
    "Petrov", "Ivanov", "Sokolov", "Volkov", "Mikhailov", "Fedorov",
]

INTRO_STUDY_INTERESTS = [
    "machine learning and data science", "web development and UI/UX design",
    "algorithms and competitive programming", "mathematics and theoretical CS",
    "mobile app development", "cybersecurity and ethical hacking",
    "database systems and backend engineering", "cloud computing and DevOps",
    "embedded systems and IoT", "natural language processing",
    "computer vision and image processing", "biochemistry and molecular biology",
    "organic chemistry", "quantum mechanics and theoretical physics",
    "econometrics and financial modelling", "neuroscience and cognitive psychology",
    "structural engineering and materials science", "signal processing",
    "renewable energy and sustainability", "biomedical engineering",
]

INTRO_GOALS = [
    "land a software engineering internship by the end of the year",
    "publish a research paper before I graduate",
    "build something that solves a real problem in my community",
    "improve my problem-solving speed for technical interviews",
    "find a study group I can grow with consistently",
    "deepen my understanding of the fundamentals rather than just passing exams",
    "connect with people working on interesting projects",
    "contribute to open-source software",
    "master the core concepts in my field before touching advanced topics",
    "learn from people ahead of me in their journey",
]

INTRO_OFFER_TEMPLATES = [
    "I'm happy to help with {subject1} if anyone needs it",
    "I'm pretty solid in {subject1} — feel free to ask questions",
    "I can offer study sessions on {subject1} and {subject2}",
    "ping me if you're struggling with {subject1}",
    "I've tutored {subject1} before and enjoy explaining it",
]

INTRO_BODIES = [
    (
        "Hi everyone! My name is {name} and I just joined StudyHub. I'm a {level} student "
        "studying {dept} and I'm really excited to be part of this community.\n\n"
        "I'm particularly interested in {interest}, and my main goal right now is to {goal}. "
        "{offer}. Would love to connect with anyone studying similar things — "
        "feel free to send me a connection request! 😊"
    ),
    (
        "Hello StudyHub! 👋 I'm {name}, a {level} {dept} student. Just created my account "
        "today and already impressed by how active this community is.\n\n"
        "A little about me: I'm passionate about {interest}. {offer}. "
        "Looking forward to learning from everyone here and hopefully contributing too. "
        "Let's connect!"
    ),
    (
        "Hey everyone, I'm {name}! New here and wanted to introduce myself properly.\n\n"
        "I'm studying {dept} ({level}) and my current focus is {interest}. "
        "My goal is to {goal}. I've heard great things about this platform from a classmate "
        "and decided to finally sign up. {offer}. Drop me a connection! 🙌"
    ),
    (
        "What's up StudyHub! I'm {name} — {dept} student, {level}.\n\n"
        "I joined because I wanted a place to ask questions without judgment and also "
        "give back where I can. Right now I'm deep into {interest} and trying to {goal}. "
        "{offer}. Looking forward to being an active member here!"
    ),
    (
        "Hi! I'm {name}, just joined StudyHub today. I study {dept} and I'm currently at "
        "{level}.\n\n"
        "I've been self-studying {interest} on the side and it's been a great journey. "
        "My main goal is to {goal}. {offer} — just reach out! "
        "Can't wait to engage with posts here. This community seems incredibly helpful 🎉"
    ),
    (
        "Hello everyone! My name is {name}. I'm new to StudyHub and excited to get started.\n\n"
        "I'm a {level} student in {dept}. My academic interests lean toward {interest}, "
        "and I'm working toward a goal to {goal}. {offer}. "
        "Looking forward to connecting with fellow students and building something great together! 🚀"
    ),
]

NOTIFICATION_TITLES = [
    "{username} replied to your comment",
    "{username} reacted to your post",
    "{username} bookmarked your post",
    "{username} sent you a connection request",
    "Your post got 10 reactions!",
    "{username} marked your comment as helpful",
    "New activity in your study thread",
    "{username} mentioned you in a comment",
]

BADGE_DEFINITIONS = [
    ("First Post", "Posted your first question or discussion", "🌱", "posting", "common"),
    ("Helper", "Had a comment marked as helpful for the first time", "🤝", "engagement", "common"),
    ("Popular Post", "A post of yours received 10+ reactions", "🔥", "engagement", "uncommon"),
    ("Thread Starter", "Created your first study thread", "🧵", "social", "common"),
    ("Consistent Contributor", "Posted on 7 different days", "📅", "activity", "uncommon"),
    ("Top Responder", "Had 5 comments marked as the solution", "🏆", "engagement", "rare"),
    ("Resource Sharer", "Shared 10+ posts with external resources", "📚", "posting", "uncommon"),
    ("Well Connected", "Made 20+ accepted connections", "🌐", "social", "uncommon"),
    ("Master", "Reached 1000 reputation points", "⭐", "reputation", "rare"),
    ("Bookmarked Expert", "Had a post bookmarked 15+ times", "🔖", "engagement", "rare"),
    ("Early Adopter", "Joined in the first month of the platform", "🚀", "special", "legendary"),
    ("Problem Solver", "Answered 10+ problem posts with a solution", "🔧", "engagement", "rare"),
]

REPUTATION_ACTIONS = [
    ("post_created", 5), ("comment_posted", 2), ("reaction_received", 3),
    ("helpful_received", 10), ("solution_accepted", 15), ("bookmark_received", 2),
    ("connection_made", 1),
]


# ══════════════════════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def random_date(days_ago_max=120):
    return datetime.utcnow() - timedelta(
        days=random.randint(0, days_ago_max),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )


def make_username(first: str, last: str, index: int) -> str:
    """Generate a varied, realistic username."""
    templates = [
        f"{first.lower()}.{last.lower()}",
        f"{first.lower()}{last.lower()}{random.randint(1, 99)}",
        f"{first.lower()}_{last.lower()}",
        f"{first[:2].lower()}{last.lower()}{random.randint(10, 999)}",
        f"{last.lower()}.{first.lower()}",
        f"{first.lower()}{random.randint(100, 9999)}",
        f"the_{first.lower()}_{last[:3].lower()}",
    ]
    raw = random.choice(templates)
    # ensure uniqueness by appending index if needed
    return raw[:40] + str(index) if len(raw) > 45 else raw


def make_bio(first: str, dept: str, level: str, tag1: str, tag2: str, tag3: str) -> str:
    template = random.choice(BIO_TEMPLATES)
    career = DEPT_CAREERS.get(dept, "Professional")
    return template.format(
        level=level, dept=dept, tag1=tag1, tag2=tag2, tag3=tag3,
        dept_career=career, first=first,
    )


def pick_tags(dept: str, n: int) -> list:
    """Pick tags biased towards a department's relevant subjects."""
    dept_bias = {
        "Computer Science": ["Python", "JavaScript", "Algorithms", "Data Structures", "SQL", "Web Development", "Machine Learning"],
        "Electrical Engineering": ["Circuit Analysis", "Signal Processing", "Electromagnetism", "Embedded Systems"],
        "Mechanical Engineering": ["Thermodynamics", "Fluid Mechanics", "Structural Analysis", "Classical Mechanics"],
        "Civil Engineering": ["Structural Analysis", "Fluid Mechanics", "Mathematics"],
        "Chemical Engineering": ["Chemistry", "Thermodynamics", "Organic Chemistry"],
        "Biology": ["Cell Biology", "Genetics", "Biochemistry", "Microbiology", "Anatomy"],
        "Chemistry": ["Organic Chemistry", "Inorganic Chemistry", "Biochemistry"],
        "Physics": ["Classical Mechanics", "Electromagnetism", "Quantum Physics", "Thermodynamics"],
        "Mathematics": ["Calculus", "Linear Algebra", "Differential Equations", "Probability", "Statistics", "Discrete Mathematics"],
        "Statistics": ["Statistics", "Probability", "Data Analysis", "Python", "Data Science"],
        "Economics": ["Microeconomics", "Macroeconomics", "Statistics"],
        "Accounting": ["Financial Accounting", "Business Administration"],
        "Business Administration": ["Management", "Financial Accounting", "Microeconomics"],
        "Medicine": ["Anatomy", "Pharmacology", "Biochemistry", "Cell Biology"],
        "Pharmacy": ["Pharmacology", "Organic Chemistry", "Biochemistry"],
    }
    biased = dept_bias.get(dept, [])
    pool = biased + [t for t in ALL_TAGS if t not in biased]
    return random.sample(pool, min(n, len(pool)))


def commit_batch(items_added: int, session) -> int:
    """Commit if batch size reached; returns reset counter."""
    if items_added >= BATCH:
        session.commit()
        return 0
    return items_added


# ══════════════════════════════════════════════════════════════════════════════
#  CLEAR DATABASE
# ══════════════════════════════════════════════════════════════════════════════

def clear_database():
    print("⚠️  Clearing database tables...")
    order = [
        CommentHelpfulMark, CommentLike, PostView, PostFollow, Bookmark,
        PostReaction, ThreadMessage, ThreadMember, Thread, Comment, Post,
        StudyBuddyMatch, StudyBuddyRequest, Connection, UserActivity,
        ReputationHistory, UserBadge, Badge, Notification,
        OnboardingDetails, StudentProfile, User,
    ]
    for model in order:
        try:
            db.session.query(model).delete()
        except Exception:
            db.session.rollback()
    db.session.commit()
    print("✅ Database cleared.")


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — USERS
# ══════════════════════════════════════════════════════════════════════════════

def seed_users(count: int = 1000) -> list:
    print(f"\n👤 Creating {count} users...")
    users = []
    hashed_pw = generate_password_hash("password123")
    used_usernames = set()
    used_emails = set()
    batch_count = 0

    for i in range(count):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        dept = random.choice(DEPARTMENTS)
        level = random.choice(CLASS_LEVELS)

        # Unique email
        base_email = f"{first.lower()}.{last.lower()}{i}"
        email = f"{base_email}@studyhub.com"
        while email in used_emails:
            email = f"{base_email}_{random.randint(1, 999)}@studyhub.com"
        used_emails.add(email)

        # Unique username
        username = make_username(first, last, i)
        while username in used_usernames:
            username = f"{username[:30]}_{random.randint(1, 999)}"
        used_usernames.add(username)

        tags = pick_tags(dept, 8)
        tag1, tag2, tag3 = tags[0], tags[1], tags[2]
        rep = random.randint(0, 900)

        user = User(
            username=username,
            email=email,
            name=f"{first} {last}",
            pin=hashed_pw,
            role="student",
            status="approved",
            email_verified=True,
            bio=make_bio(first, dept, level, tag1, tag2, tag3),
            avatar=None,   # ← NO avatars as requested
            reputation=rep,
            login_streak=random.randint(0, 60),
            total_posts=0,
            total_helpful=0,
            joined_at=random_date(365),
            last_active=random_date(14),
            skills=tags[:random.randint(3, 6)],
            learning_goals=pick_tags(dept, random.randint(2, 4)),
        )
        user.update_reputation_level()

        db.session.add(user)
        db.session.flush()

        # StudentProfile
        profile = StudentProfile(
            user_id=user.id,
            full_name=user.name,
            department=dept,
            class_name=level,
            pin=hashed_pw,
            username=username,
            status="active",
        )
        db.session.add(profile)

        # OnboardingDetails
        onboarding = OnboardingDetails(
            user_id=user.id,
            email=email,
            department=dept,
            class_level=level,
            subjects=pick_tags(dept, random.randint(3, 6)),
            learning_style=random.choice(LEARNING_STYLES),
            study_preferences=random.sample(STUDY_PREFERENCES, k=random.randint(1, 3)),
            help_subjects=pick_tags(dept, random.randint(1, 3)),
            strong_subjects=pick_tags(dept, random.randint(2, 4)),
            session_length=random.choice(SESSION_LENGTHS),
        )
        db.session.add(onboarding)

        users.append(user)
        batch_count += 1
        if batch_count >= BATCH:
            db.session.commit()
            batch_count = 0
            print(f"   … {len(users)} users committed")

    db.session.commit()
    print(f"✅ {len(users)} users created.")
    return users


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — CONNECTIONS (sparse social graph)
# ══════════════════════════════════════════════════════════════════════════════

def seed_connections(users: list) -> list:
    print("\n🤝 Building connection graph...")
    connections = []
    seen = set()   # store (min_id, max_id) to prevent both-direction duplicates

    for user in users:
        num = random.randint(3, 18)
        candidates = random.sample([u for u in users if u.id != user.id],
                                   min(num + 5, len(users) - 1))
        added = 0
        for other in candidates:
            if added >= num:
                break
            pair = (min(user.id, other.id), max(user.id, other.id))
            if pair in seen:
                continue
            seen.add(pair)

            status = random.choices(
                ["accepted", "pending", "declined"],
                weights=[70, 25, 5]
            )[0]
            requested = random_date(90)

            conn = Connection(
                requester_id=user.id,
                receiver_id=other.id,
                status=status,
                requested_at=requested,
                responded_at=requested + timedelta(hours=random.randint(1, 72)) if status != "pending" else None,
                is_seen=status != "pending",
                connection_type="connection",
            )
            db.session.add(conn)
            connections.append(conn)
            added += 1

        if len(connections) % BATCH == 0:
            db.session.commit()

    db.session.commit()
    print(f"✅ {len(connections)} connections created.")
    return connections


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — POSTS
# ══════════════════════════════════════════════════════════════════════════════

def seed_posts(users: list, count: int = 500) -> list:
    print(f"\n📝 Creating {count} posts...")
    posts = []
    # Build a full catalogue by repeating/sampling from POST_CATALOGUE
    # Each user's department biases their post topic
    user_by_dept = {}
    for u in users:
        dept = u.student_profile.department if u.student_profile else "Computer Science"
        user_by_dept.setdefault(dept, []).append(u)

    batch_count = 0
    # Shuffle catalogue so subjects are evenly distributed across the feed
    catalogue_pool = POST_CATALOGUE * (count // len(POST_CATALOGUE) + 2)
    random.shuffle(catalogue_pool)

    for i, entry in enumerate(catalogue_pool[:count]):
        title, body, post_type, tag_pool, resources, suggested_dept = entry

        # Find an author in a matching department if possible
        dept_users = user_by_dept.get(suggested_dept, users)
        author = random.choice(dept_users if dept_users else users)

        author_dept = (
            author.student_profile.department
            if author.student_profile else suggested_dept
        )
        tags = pick_tags(author_dept, random.randint(2, 6))
        # merge catalogue tags
        for t in tag_pool:
            if t not in tags:
                tags.append(t)
        tags = tags[:8]

        # Lightly vary the title to avoid exact duplicates in bulk
        suffix_options = [
            "", " — help needed", " (study group)", " — 2024",
            " — anyone?", " (follow-up)", "",
        ]
        final_title = title + (random.choice(suffix_options) if i % 4 == 0 else "")
        final_title = final_title[:200]

        post = Post(
            student_id=author.id,
            title=final_title,
            text_content=body,
            post_type=post_type,
            department=author_dept,
            tags=tags,
            resources=resources if resources and random.random() > 0.3 else [],
            thread_enabled=random.random() > 0.75,
            is_solved=False if post_type in ["question", "problem"] else None,
            is_pinned=random.random() > 0.97,
            posted_at=random_date(90),
            views_count=random.randint(5, 800),
            positive_reactions_count=0,
            helpful_reactions_count=0,
            comments_count=0,
            bookmark_count=0,
        )

        db.session.add(post)
        db.session.flush()
        author.total_posts += 1
        posts.append(post)

        batch_count += 1
        if batch_count >= BATCH:
            db.session.commit()
            batch_count = 0
            print(f"   … {len(posts)} posts committed")

    db.session.commit()
    print(f"✅ {len(posts)} posts created.")
    return posts


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 4 — COMMENTS  (depth 0 + depth 1 only, context-aware)
# ══════════════════════════════════════════════════════════════════════════════

def seed_comments(users: list, posts: list) -> list:
    print("\n💬 Seeding comments...")
    comments = []
    batch_count = 0

    for post in posts:
        post_type = post.post_type if post.post_type in COMMENTS_BY_TYPE else "discussion"
        comment_pool = COMMENTS_BY_TYPE[post_type]
        num_top = random.randint(1, 9)

        top_level_comments = []

        for _ in range(num_top):
            commenter = random.choice(users)
            body = random.choice(comment_pool)
            # fill any placeholder
            body = body.replace("{insight}", random.choice([
                "the operation order matters more than the structure itself",
                "you need to separate concerns at a higher level",
                "the edge case is where the real logic lives",
                "the base case is doing more work than it looks",
                "the invariant you're relying on breaks at the boundary",
            ]))

            comment = Comment(
                post_id=post.id,
                student_id=commenter.id,
                parent_id=None,
                text_content=body,
                resources=[],
                likes_count=0,
                helpful_count=0,
                replies_count=0,
                depth_level=0,
                posted_at=post.posted_at + timedelta(minutes=random.randint(15, 2000)),
                is_solution=False,
            )
            db.session.add(comment)
            db.session.flush()
            comments.append(comment)
            top_level_comments.append(comment)
            post.comments_count += 1

            batch_count += 1
            if batch_count >= BATCH:
                db.session.commit()
                batch_count = 0

        # Depth-1 replies (strictly no deeper)
        for parent in top_level_comments:
            if random.random() < 0.55:   # 55% chance of getting at least one reply
                num_replies = random.randint(1, 3)
                parent_author = next((u for u in users if u.id == parent.student_id), None)
                parent_username = parent_author.username if parent_author else "someone"

                for _ in range(num_replies):
                    reply_author = random.choice(users)
                    reply_text = random.choice(REPLY_TEMPLATES).format(
                        username=parent_username,
                        followup=random.choice(FOLLOWUP_FRAGMENTS),
                    )

                    reply = Comment(
                        post_id=post.id,
                        student_id=reply_author.id,
                        parent_id=parent.id,   # depth 1 — parent is top-level comment
                        text_content=reply_text,
                        resources=[],
                        likes_count=0,
                        helpful_count=0,
                        replies_count=0,
                        depth_level=1,          # strictly enforced
                        posted_at=parent.posted_at + timedelta(minutes=random.randint(10, 900)),
                        is_solution=False,
                    )
                    db.session.add(reply)
                    comments.append(reply)
                    parent.replies_count += 1
                    post.comments_count += 1

                    batch_count += 1
                    if batch_count >= BATCH:
                        db.session.commit()
                        batch_count = 0

    # Mark some question/problem posts as solved
    for post in posts:
        if post.post_type in ["question", "problem"] and random.random() > 0.45:
            candidates = [c for c in comments if c.post_id == post.id and c.parent_id is None]
            if candidates:
                solution = random.choice(candidates)
                solution.is_solution = True
                post.is_solved = True
                post.solved_at = solution.posted_at + timedelta(hours=random.randint(1, 48))

    db.session.commit()
    print(f"✅ {len(comments)} comments created.")
    return comments


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 5 — REACTIONS
# ══════════════════════════════════════════════════════════════════════════════

def seed_reactions(users: list, posts: list) -> int:
    print("\n👍 Seeding post reactions...")
    count = 0
    seen = set()   # (post_id, student_id)
    batch_count = 0

    for post in posts:
        n = random.randint(3, min(40, len(users)))
        reactors = random.sample(users, n)
        for user in reactors:
            if user.id == post.student_id:
                continue
            key = (post.id, user.id)
            if key in seen:
                continue
            seen.add(key)

            rtype = random.choice(REACTION_TYPES)
            rxn = PostReaction(
                post_id=post.id,
                student_id=user.id,
                reaction_type=rtype,
                reacted_at=post.posted_at + timedelta(hours=random.randint(1, 72)),
            )
            db.session.add(rxn)
            post.positive_reactions_count += 1
            if rtype == "helpful":
                post.helpful_reactions_count = (post.helpful_reactions_count or 0) + 1
                author = next((u for u in users if u.id == post.student_id), None)
                if author:
                    author.total_helpful += 1
            count += 1
            batch_count += 1
            if batch_count >= BATCH:
                db.session.commit()
                batch_count = 0

    db.session.commit()
    print(f"✅ {count} reactions created.")
    return count


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 5b — COMMENT ENGAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

def seed_comment_engagement(users: list, comments: list) -> tuple:
    print("\n💬 Seeding comment likes and helpful marks...")
    like_count = 0
    helpful_count = 0
    like_seen = set()
    helpful_seen = set()
    batch_count = 0

    for comment in comments:
        # Likes
        n_likes = random.randint(0, min(12, len(users)))
        for liker in random.sample(users, n_likes):
            if liker.id == comment.student_id:
                continue
            key = (comment.id, liker.id)
            if key in like_seen:
                continue
            like_seen.add(key)

            db.session.add(CommentLike(
                comment_id=comment.id,
                student_id=liker.id,
                liked_at=comment.posted_at + timedelta(hours=random.randint(1, 48)),
            ))
            comment.likes_count += 1
            like_count += 1
            batch_count += 1
            if batch_count >= BATCH:
                db.session.commit()
                batch_count = 0

        # Helpful marks (less frequent)
        if random.random() > 0.65:
            n_helpful = random.randint(1, min(6, len(users)))
            for helper in random.sample(users, n_helpful):
                if helper.id == comment.student_id:
                    continue
                key = (comment.id, helper.id)
                if key in helpful_seen:
                    continue
                helpful_seen.add(key)

                db.session.add(CommentHelpfulMark(
                    comment_id=comment.id,
                    user_id=helper.id,
                ))
                comment.helpful_count += 1
                helpful_count += 1
                batch_count += 1
                if batch_count >= BATCH:
                    db.session.commit()
                    batch_count = 0

    db.session.commit()
    print(f"✅ {like_count} comment likes + {helpful_count} helpful marks.")
    return like_count, helpful_count


# (Post views and bookmarks are not seeded — populated by real user activity)


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 7b — POST FOLLOWS
# ══════════════════════════════════════════════════════════════════════════════

def seed_post_follows(users: list, posts: list) -> int:
    print("\n🔔 Seeding post follows...")
    count = 0
    seen = set()
    batch_count = 0
    # Only follow questions and discussions more naturally
    followable = [p for p in posts if p.post_type in ("question", "discussion", "problem")]
    for post in random.sample(followable, min(len(followable), 200)):
        n = random.randint(2, min(20, len(users)))
        for user in random.sample(users, n):
            key = (post.id, user.id)
            if key in seen:
                continue
            seen.add(key)
            db.session.add(PostFollow(
                post_id=post.id,
                student_id=user.id,
                followed_at=post.posted_at + timedelta(hours=random.randint(1, 48)),
                notify_on_comment=True,
                notify_on_solution=True,
            ))
            count += 1
            batch_count += 1
            if batch_count >= BATCH:
                db.session.commit()
                batch_count = 0

    db.session.commit()
    print(f"✅ {count} post follows created.")
    return count


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 8 — STUDY THREADS
# ══════════════════════════════════════════════════════════════════════════════

def seed_threads(users: list, posts: list) -> list:
    print("\n🧵 Seeding study threads...")
    threads = []
    thread_member_seen = set()   # (thread_id, student_id)
    batch_count = 0

    # Post-linked threads
    thread_posts = [p for p in posts if p.thread_enabled]
    thread_posts = random.sample(thread_posts, min(150, len(thread_posts)))

    for post in thread_posts:
        creator_id = post.student_id
        dept = post.department or "Computer Science"
        created_at = post.posted_at + timedelta(hours=random.randint(1, 72))

        thread = Thread(
            post_id=post.id,
            creator_id=creator_id,
            title=f"Study Group: {post.title[:60]}",
            description=random.choice(THREAD_DESCRIPTIONS),
            is_open=random.random() > 0.2,
            max_members=random.randint(5, 20),
            requires_approval=random.random() > 0.5,
            department=dept,
            tags=post.tags[:4] if post.tags else [],
            member_count=1,
            message_count=0,
            created_at=created_at,
            last_activity=random_date(14),
        )
        db.session.add(thread)
        db.session.flush()
        threads.append(thread)

        # Creator as member
        key = (thread.id, creator_id)
        if key not in thread_member_seen:
            thread_member_seen.add(key)
            db.session.add(ThreadMember(
                thread_id=thread.id,
                student_id=creator_id,
                role="creator",
                joined_at=created_at,
            ))

        # Additional members
        candidates = [u for u in users if u.id != creator_id]
        n_members = random.randint(2, min(thread.max_members - 1, 12))
        for member in random.sample(candidates, min(n_members, len(candidates))):
            key = (thread.id, member.id)
            if key in thread_member_seen:
                continue
            thread_member_seen.add(key)
            db.session.add(ThreadMember(
                thread_id=thread.id,
                student_id=member.id,
                role="member",
                joined_at=created_at + timedelta(hours=random.randint(1, 96)),
            ))
            thread.member_count += 1

        # Seed a few thread messages
        msg_count = random.randint(3, 12)
        msg_authors = random.sample(users, min(msg_count, len(users)))
        for j, msg_author in enumerate(msg_authors):
            db.session.add(ThreadMessage(
                thread_id=thread.id,
                sender_id=msg_author.id,
                text_content=random.choice(THREAD_MESSAGE_POOL),
                sent_at=created_at + timedelta(hours=j * random.randint(1, 6)),
            ))
            thread.message_count += 1

        batch_count += 1
        if batch_count >= 20:
            db.session.commit()
            batch_count = 0

    # Standalone threads (not linked to a post)
    standalone_count = 50
    for _ in range(standalone_count):
        creator = random.choice(users)
        dept = (
            creator.student_profile.department
            if creator.student_profile else random.choice(DEPARTMENTS)
        )
        tag_pool = pick_tags(dept, 4)
        created_at = random_date(60)
        subject = random.choice(tag_pool)

        thread = Thread(
            post_id=None,
            creator_id=creator.id,
            title=f"{subject} Study Group — {dept}",
            description=random.choice(THREAD_DESCRIPTIONS),
            is_open=True,
            max_members=random.randint(6, 15),
            requires_approval=False,
            department=dept,
            tags=tag_pool,
            member_count=1,
            message_count=0,
            created_at=created_at,
            last_activity=random_date(7),
        )
        db.session.add(thread)
        db.session.flush()
        threads.append(thread)

        key = (thread.id, creator.id)
        thread_member_seen.add(key)
        db.session.add(ThreadMember(
            thread_id=thread.id,
            student_id=creator.id,
            role="creator",
            joined_at=created_at,
        ))

        candidates = [u for u in users if u.id != creator.id]
        n_members = random.randint(3, min(thread.max_members - 1, 8))
        for member in random.sample(candidates, min(n_members, len(candidates))):
            key = (thread.id, member.id)
            if key in thread_member_seen:
                continue
            thread_member_seen.add(key)
            db.session.add(ThreadMember(
                thread_id=thread.id,
                student_id=member.id,
                role="member",
                joined_at=created_at + timedelta(hours=random.randint(1, 48)),
            ))
            thread.member_count += 1

        for j in range(random.randint(2, 8)):
            msg_author = random.choice(users)
            db.session.add(ThreadMessage(
                thread_id=thread.id,
                sender_id=msg_author.id,
                text_content=random.choice(THREAD_MESSAGE_POOL),
                sent_at=created_at + timedelta(hours=j * random.randint(1, 8)),
            ))
            thread.message_count += 1

    db.session.commit()
    print(f"✅ {len(threads)} threads created.")
    return threads


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 9 — STUDY BUDDIES
# ══════════════════════════════════════════════════════════════════════════════

def seed_study_buddies(users: list) -> tuple:
    print("\n📚 Seeding study buddy requests and matches...")
    req_seen = set()
    match_seen = set()
    requests = []
    matches = []
    batch_count = 0

    for _ in range(min(100, len(users) // 5)):
        requester = random.choice(users)
        receiver = random.choice([u for u in users if u.id != requester.id])
        key = (requester.id, receiver.id)
        if key in req_seen:
            continue
        req_seen.add(key)

        status = random.choices(["pending", "accepted", "rejected"], weights=[30, 55, 15])[0]
        requested_at = random_date(60)

        req = StudyBuddyRequest(
            requester_id=requester.id,
            receiver_id=receiver.id,
            subjects=pick_tags(
                requester.student_profile.department if requester.student_profile else "Computer Science",
                random.randint(2, 4),
            ),
            message=random.choice([
                "Hey! I noticed we're studying the same topics. Want to form a study pair?",
                "I'd love to have a study buddy for the upcoming exams. Are you interested?",
                "You seem really knowledgeable in this area — would you be open to study sessions?",
                "Let's help each other prepare. I'm strong in theory, you seem great at problems.",
                "I've been looking for someone to review past papers with. Interested?",
            ]),
            status=status,
            requested_at=requested_at,
            responded_at=requested_at + timedelta(hours=random.randint(1, 48)) if status != "pending" else None,
        )
        db.session.add(req)
        requests.append(req)

        if status == "accepted":
            match_key = (min(requester.id, receiver.id), max(requester.id, receiver.id))
            if match_key not in match_seen:
                match_seen.add(match_key)
                match = StudyBuddyMatch(
                    user1_id=requester.id,
                    user2_id=receiver.id,
                    subjects=req.subjects,
                    sessions_count=random.randint(0, 8),
                    is_active=random.random() > 0.25,
                    matched_at=req.responded_at,
                    last_activity=random_date(14),
                )
                db.session.add(match)
                matches.append(match)

        batch_count += 1
        if batch_count >= BATCH:
            db.session.commit()
            batch_count = 0

    db.session.commit()
    print(f"✅ {len(requests)} buddy requests + {len(matches)} matches.")
    return requests, matches


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 10 — BADGES & REPUTATION
# ══════════════════════════════════════════════════════════════════════════════

def seed_badges(users: list) -> list:
    print("\n🏅 Seeding badges and reputation history...")
    badges = []

    # Create badge definitions
    for name, desc, icon, category, rarity in BADGE_DEFINITIONS:
        existing = Badge.query.filter_by(name=name).first()
        if not existing:
            badge = Badge(
                name=name,
                description=desc,
                icon=icon,
                category=category,
                rarity=rarity,
                is_active=True,
            )
            db.session.add(badge)
            badges.append(badge)
    db.session.commit()
    badges = Badge.query.all()

    # Award badges to users
    ub_seen = set()
    ub_count = 0
    rep_count = 0
    batch_count = 0

    for user in users:
        # Each user earns 1-4 badges randomly
        n_badges = random.randint(1, min(4, len(badges)))
        for badge in random.sample(badges, n_badges):
            key = (user.id, badge.id)
            if key in ub_seen:
                continue
            ub_seen.add(key)
            db.session.add(UserBadge(
                user_id=user.id,
                badge_id=badge.id,
                earned_at=random_date(180),
                is_featured=random.random() > 0.7,
            ))
            badge.awarded_count += 1
            ub_count += 1

        # Reputation history entries (3–8 per user)
        current_rep = user.reputation
        n_rep = random.randint(3, 8)
        actions = random.choices(REPUTATION_ACTIONS, k=n_rep)
        running = max(0, current_rep - sum(pts for _, pts in actions))
        for action, pts in actions:
            before = running
            running += pts
            db.session.add(ReputationHistory(
                user_id=user.id,
                action=action,
                points_change=pts,
                related_type="post",
                related_id=None,
                created_at=random_date(180),
                reputation_before=before,
                reputation_after=running,
            ))
            rep_count += 1

        batch_count += 1
        if batch_count >= BATCH:
            db.session.commit()
            batch_count = 0

    db.session.commit()
    print(f"✅ {ub_count} user badges + {rep_count} reputation entries.")
    return badges


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 11 — INTRO / WELCOME POSTS  (~70 posts)
# ══════════════════════════════════════════════════════════════════════════════

def seed_intro_posts(users: list, count: int = 70) -> list:
    print(f"\n👋 Seeding {count} intro/welcome posts...")
    posts = []
    batch_count = 0

    for i in range(count):
        author = random.choice(users)
        first = random.choice(INTRO_FIRST_NAMES)
        last = random.choice(INTRO_LAST_NAMES)
        display_name = f"{first} {last}"

        dept = (
            author.student_profile.department
            if author.student_profile else random.choice(DEPARTMENTS)
        )
        level = (
            author.student_profile.class_name
            if author.student_profile else random.choice(CLASS_LEVELS)
        )

        interest = random.choice(INTRO_STUDY_INTERESTS)
        goal = random.choice(INTRO_GOALS)
        tags = pick_tags(dept, 3)
        subject1 = tags[0] if tags else "this subject"
        subject2 = tags[1] if len(tags) > 1 else "related topics"

        offer = random.choice(INTRO_OFFER_TEMPLATES).format(
            subject1=subject1, subject2=subject2
        )

        body_template = random.choice(INTRO_BODIES)
        body = body_template.format(
            name=display_name,
            level=level,
            dept=dept,
            interest=interest,
            goal=goal,
            offer=offer,
        )

        post = Post(
            student_id=author.id,
            title=f"Hi, I'm {display_name} — new to StudyHub! 👋",
            text_content=body,
            post_type="discussion",
            department=dept,
            tags=tags[:3],
            resources=[],
            thread_enabled=False,
            is_solved=None,
            is_pinned=False,
            posted_at=random_date(45),
            views_count=random.randint(20, 300),
            positive_reactions_count=0,
            helpful_reactions_count=0,
            comments_count=0,
            bookmark_count=0,
        )
        db.session.add(post)
        db.session.flush()
        author.total_posts += 1
        posts.append(post)

        # Welcome replies (1–4 per intro post)
        n_welcome = random.randint(1, 4)
        welcome_messages = [
            f"Welcome to StudyHub, {first}! Great to have you here 🙌",
            f"Hey {first}! Glad you joined. Feel free to reach out anytime.",
            f"Welcome! We have a great community here. Hope you enjoy it, {first}!",
            f"Hi {first}! Sent you a connection request. Let's study together!",
            f"Welcome aboard, {first}! Your interests align a lot with mine. Let's connect.",
            f"Great intro, {first}! Looking forward to seeing your posts here.",
            f"Hey {first}! I'm also studying {subject1} — we should definitely collaborate!".replace("{subject1}", subject1),
            f"Welcome! {first}, make sure to check out the study threads — very active.",
        ]
        for _ in range(n_welcome):
            commenter = random.choice(users)
            if commenter.id == author.id:
                continue
            welcome_comment = Comment(
                post_id=post.id,
                student_id=commenter.id,
                parent_id=None,
                text_content=random.choice(welcome_messages),
                resources=[],
                likes_count=0,
                helpful_count=0,
                replies_count=0,
                depth_level=0,
                posted_at=post.posted_at + timedelta(minutes=random.randint(15, 600)),
                is_solution=False,
            )
            db.session.add(welcome_comment)
            post.comments_count += 1

        batch_count += 1
        if batch_count >= BATCH:
            db.session.commit()
            batch_count = 0
            print(f"   … {len(posts)} intro posts committed")

    db.session.commit()
    print(f"✅ {len(posts)} intro posts created.")
    return posts


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════════

def seed_all(clear: bool = False, user_count: int = 1000):
    print("\n" + "=" * 65)
    print("🌱  StudyHub Production Seed v2")
    print("=" * 65)

    if clear:
        answer = input("\n⚠️  This will DELETE all existing data. Continue? (yes/no): ")
        if answer.strip().lower() != "yes":
            print("❌ Seeding cancelled.")
            return
        clear_database()

    try:
        users  = seed_users(user_count)
        _conns = seed_connections(users)
        posts  = seed_posts(users, count=max(300, user_count // 2))
        intro  = seed_intro_posts(users, count=70)
        all_posts = posts + intro
        cmnts  = seed_comments(users, posts)
        seed_reactions(users, all_posts)
        seed_comment_engagement(users, cmnts)
        seed_post_follows(users, posts)
        seed_threads(users, posts)
        seed_study_buddies(users)
        seed_badges(users)

        print("\n" + "=" * 65)
        print("✅  Seeding complete!")
        print("=" * 65)
        print("\n📊  Summary:")
        print(f"   Users          : {User.query.count():,}")
        print(f"   Posts (study)  : {len(posts):,}")
        print(f"   Posts (intro)  : {len(intro):,}")
        print(f"   Comments       : {Comment.query.count():,}")
        print(f"   Reactions      : {PostReaction.query.count():,}")
        print(f"   Connections    : {Connection.query.count():,}")
        print(f"   Threads        : {Thread.query.count():,}")
        print(f"   Study Buddies  : {StudyBuddyMatch.query.count():,}")
        print(f"   Badges         : {Badge.query.count():,}")
        print("\n📝  Test credentials:")
        print("   Email    : adaeze.abara0@studyhub.com  (adjust index if needed)")
        print("   Password : password123")
        print()

    except Exception as exc:
        print(f"\n❌ Seeding failed: {exc}")
        db.session.rollback()
        raise


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed StudyHub production database")
    parser.add_argument("--clear", action="store_true",
                        help="Wipe all data before seeding")
    parser.add_argument("--users", type=int, default=1000,
                        help="Number of users to create (default: 1000)")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        seed_all(clear=args.clear, user_count=args.users)
