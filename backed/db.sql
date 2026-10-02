--
-- PostgreSQL database dump
--

\restrict kUJgrCFu9NKWHyS7aluq1qVbmMNd7jryy6onAUcC7e3LaBvKft8dVuqLYEmAYaP

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

-- Started on 2026-10-02 14:37:54

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 227 (class 1259 OID 49979)
-- Name: applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applications (
    id integer NOT NULL,
    session_id integer NOT NULL,
    student text NOT NULL,
    class_name text DEFAULT ''::text NOT NULL,
    reason text DEFAULT 'Other'::text NOT NULL,
    booked_by text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attendance text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT applications_attendance_check CHECK ((attendance = ANY (ARRAY['present'::text, 'absent'::text]))),
    CONSTRAINT applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


ALTER TABLE public.applications OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 49946)
-- Name: labs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.labs (
    id integer NOT NULL,
    name text NOT NULL,
    pcs integer NOT NULL,
    CONSTRAINT labs_pcs_check CHECK ((pcs >= 0))
);


ALTER TABLE public.labs OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 49961)
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    lab_id integer NOT NULL,
    date date NOT NULL,
    starts_at time without time zone NOT NULL,
    ends_at time without time zone NOT NULL,
    CONSTRAINT sessions_check CHECK ((ends_at > starts_at))
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 50025)
-- Name: application_details; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.application_details AS
 SELECT a.id,
    a.session_id AS sid,
    a.student AS name,
    a.class_name AS cls,
    a.reason,
    a.booked_by AS "bookedBy",
    a.status,
    a.attendance AS att,
    a.created_at AS at,
    l.name AS lab,
    l.id AS "labId",
    (s.date)::text AS date,
    to_char((s.starts_at)::interval, 'HH24:MI'::text) AS "from",
    to_char((s.ends_at)::interval, 'HH24:MI'::text) AS "to"
   FROM ((public.applications a
     JOIN public.sessions s ON ((s.id = a.session_id)))
     JOIN public.labs l ON ((l.id = s.lab_id)));


ALTER VIEW public.application_details OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 49978)
-- Name: applications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.applications_id_seq OWNER TO postgres;

--
-- TOC entry 5041 (class 0 OID 0)
-- Dependencies: 226
-- Name: applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;


--
-- TOC entry 228 (class 1259 OID 50008)
-- Name: blacklist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blacklist (
    name text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blacklist OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 49945)
-- Name: labs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.labs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.labs_id_seq OWNER TO postgres;

--
-- TOC entry 5042 (class 0 OID 0)
-- Dependencies: 222
-- Name: labs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.labs_id_seq OWNED BY public.labs.id;


--
-- TOC entry 221 (class 1259 OID 49936)
-- Name: options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.options (
    key text NOT NULL,
    value jsonb NOT NULL
);


ALTER TABLE public.options OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 50020)
-- Name: session_seats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.session_seats AS
 SELECT s.id,
    s.lab_id AS "labId",
    l.name AS lab,
    (s.date)::text AS date,
    to_char((s.starts_at)::interval, 'HH24:MI'::text) AS "from",
    to_char((s.ends_at)::interval, 'HH24:MI'::text) AS "to",
    l.pcs AS seats,
    (l.pcs - ( SELECT (count(*))::integer AS count
           FROM public.applications a
          WHERE ((a.session_id = s.id) AND (a.status = 'approved'::text)))) AS "left"
   FROM (public.sessions s
     JOIN public.labs l ON ((l.id = s.lab_id)));


ALTER VIEW public.session_seats OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 49960)
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5043 (class 0 OID 0)
-- Dependencies: 224
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- TOC entry 220 (class 1259 OID 49916)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    hash text NOT NULL,
    role text NOT NULL,
    profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['student'::text, 'teacher'::text, 'psychosocial'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 49915)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5044 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4845 (class 2604 OID 49982)
-- Name: applications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);


--
-- TOC entry 4843 (class 2604 OID 49949)
-- Name: labs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs ALTER COLUMN id SET DEFAULT nextval('public.labs_id_seq'::regclass);


--
-- TOC entry 4844 (class 2604 OID 49964)
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- TOC entry 4840 (class 2604 OID 49919)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5034 (class 0 OID 49979)
-- Dependencies: 227
-- Data for Name: applications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.applications (id, session_id, student, class_name, reason, booked_by, status, attendance, created_at) FROM stdin;
2	9	pacific sibomana	ingabo K	research	pacific sibomana	pending	\N	2026-10-02 14:00:55.337395+02
\.


--
-- TOC entry 5035 (class 0 OID 50008)
-- Dependencies: 228
-- Data for Name: blacklist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blacklist (name, reason, created_at) FROM stdin;
\.


--
-- TOC entry 5030 (class 0 OID 49946)
-- Dependencies: 223
-- Data for Name: labs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.labs (id, name, pcs) FROM stdin;
4	C1	20
5	C2	10
\.


--
-- TOC entry 5028 (class 0 OID 49936)
-- Dependencies: 221
-- Data for Name: options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.options (key, value) FROM stdin;
classes	["A", "B", "C"]
families	["Lance Reddic family", "thomas edson"]
clubs	["Robotics", "Debate", "Music", "None", "coding"]
combos	["MEG", "HGL"]
staffRoles	["Psychosocial worker", "teacher", "Mamas"]
reasons	["research", "Programming", "Isomo Circle", "Meetings online"]
grades	["S4", "S5", "S6"]
gradeCombos	{"S4": ["INGABE"], "S5": ["INGABO"], "S6": ["IJABO"]}
\.


--
-- TOC entry 5032 (class 0 OID 49961)
-- Dependencies: 225
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (id, lab_id, date, starts_at, ends_at) FROM stdin;
9	4	2026-10-02	14:00:00	16:00:00
10	5	2026-10-02	14:00:00	16:00:00
\.


--
-- TOC entry 5027 (class 0 OID 49916)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, email, hash, role, profile, created_at) FROM stdin;
7	teacher-testing	honorgenius001@gmail.com	$2b$10$yIeN2yRc.DrpYS7mBDIkBeEJMXtyw1NecrJYq1XMrWLNkyvUmwwiu	teacher	{}	2026-10-02 14:10:35.985583+02
\.


--
-- TOC entry 5045 (class 0 OID 0)
-- Dependencies: 226
-- Name: applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.applications_id_seq', 2, true);


--
-- TOC entry 5046 (class 0 OID 0)
-- Dependencies: 222
-- Name: labs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.labs_id_seq', 5, true);


--
-- TOC entry 5047 (class 0 OID 0)
-- Dependencies: 224
-- Name: sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sessions_id_seq', 10, true);


--
-- TOC entry 5048 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- TOC entry 4870 (class 2606 OID 50000)
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- TOC entry 4874 (class 2606 OID 50019)
-- Name: blacklist blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_pkey PRIMARY KEY (name);


--
-- TOC entry 4864 (class 2606 OID 49959)
-- Name: labs labs_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs
    ADD CONSTRAINT labs_name_key UNIQUE (name);


--
-- TOC entry 4866 (class 2606 OID 49957)
-- Name: labs labs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labs
    ADD CONSTRAINT labs_pkey PRIMARY KEY (id);


--
-- TOC entry 4862 (class 2606 OID 49944)
-- Name: options options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_pkey PRIMARY KEY (key);


--
-- TOC entry 4868 (class 2606 OID 49972)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4859 (class 2606 OID 49933)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4871 (class 1259 OID 50007)
-- Name: applications_session_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX applications_session_idx ON public.applications USING btree (session_id, status);


--
-- TOC entry 4872 (class 1259 OID 50006)
-- Name: one_live_application; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX one_live_application ON public.applications USING btree (session_id, student) WHERE (status <> 'rejected'::text);


--
-- TOC entry 4857 (class 1259 OID 49935)
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- TOC entry 4860 (class 1259 OID 49934)
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (lower(username));


--
-- TOC entry 4876 (class 2606 OID 50001)
-- Name: applications applications_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- TOC entry 4875 (class 2606 OID 49973)
-- Name: sessions sessions_lab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE CASCADE;


-- Completed on 2026-10-02 14:37:55

--
-- PostgreSQL database dump complete
--

\unrestrict kUJgrCFu9NKWHyS7aluq1qVbmMNd7jryy6onAUcC7e3LaBvKft8dVuqLYEmAYaP

