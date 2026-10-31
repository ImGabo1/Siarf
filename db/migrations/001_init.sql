-- ============================================================================
-- SIARF · Esquema inicial (PostgreSQL)
-- Las migraciones se aplican en orden alfabético y quedan registradas en la
-- tabla `migraciones`. Para cambios futuros crea 002_*.sql, 003_*.sql, etc.
-- NO edites una migración que ya fue aplicada.
-- ============================================================================

-- ── Personal y catálogos ────────────────────────────────────────────────────
create table usuarios (
  id            integer generated always as identity primary key,
  nombre        text        not null,
  email         text        not null unique,
  password_hash text        not null,
  rol           text        not null check (rol in ('admin', 'recepcionista', 'doctor')),
  activo        boolean     not null default true,
  creado_en     timestamptz not null default now()
);

create table especialidades (
  id     integer generated always as identity primary key,
  codigo text    not null unique,   -- p. ej. 'cardiologia' (lo usan las reglas)
  nombre text    not null,
  activa boolean not null default true
);

create table consultorios (
  id              integer generated always as identity primary key,
  nombre          text    not null,
  especialidad_id integer not null references especialidades (id),
  activo          boolean not null default true
);

-- Datos adicionales de los usuarios con rol 'doctor'
create table doctores (
  usuario_id      integer primary key references usuarios (id) on delete cascade,
  especialidad_id integer not null references especialidades (id),
  consultorio_id  integer references consultorios (id)
);

-- ── Pacientes ───────────────────────────────────────────────────────────────
create table pacientes (
  id               integer generated always as identity primary key,
  cedula           text        not null unique,   -- normalizada: mayúsculas, sin guiones
  nombre           text        not null,
  fecha_nacimiento date        not null,
  sexo             text        not null check (sexo in ('F', 'M')),
  telefono         text,
  creado_en        timestamptz not null default now()
);

-- ── Base de conocimiento del sistema experto ────────────────────────────────
create table sintomas (
  codigo    text primary key,   -- p. ej. 'dolor_toracico'
  nombre    text not null,
  categoria text not null
);

-- Una regla: SI (todas las condiciones) Y NO (ninguna exclusión) ENTONCES conclusión (con CF).
create table reglas (
  id             integer generated always as identity primary key,
  codigo         text         not null unique,   -- p. ej. 'C03'
  descripcion    text,
  concluye_tipo  text         not null check (concluye_tipo in ('especialidad', 'hecho')),
  concluye_valor text         not null,          -- código de especialidad o nombre del hecho derivado
  cf             numeric(4,3) not null check (cf > 0 and cf <= 1),
  prioridad      integer      not null default 1,
  urgencia       boolean      not null default false,
  activa         boolean      not null default true
);

create table regla_condiciones (
  regla_id integer not null references reglas (id) on delete cascade,
  hecho    text    not null,                      -- síntoma, hecho de edad o hecho derivado
  negada   boolean not null default false,        -- true = exclusión (la regla NO se dispara si el hecho está)
  primary key (regla_id, hecho, negada)
);

-- ── Operación: visitas (cada paso de un paciente por el hospital) ───────────
create table visitas (
  id                       integer generated always as identity primary key,
  paciente_id              integer     not null references pacientes (id),
  registrada_por           integer     references usuarios (id),
  especialidad_sugerida    text,                  -- código sugerido por el sistema experto
  especialidad_asignada_id integer     not null references especialidades (id),
  prioridad                text        not null default 'normal' check (prioridad in ('normal', 'urgente')),
  estado                   text        not null default 'espera'
                           check (estado in ('espera', 'en_consulta', 'atendida', 'cancelada')),
  hora_llegada             timestamptz not null default now(),
  hora_inicio_consulta     timestamptz,
  hora_fin_consulta        timestamptz,
  doctor_id                integer     references usuarios (id),
  consultorio_id           integer     references consultorios (id),
  diagnostico              text,
  notas                    text
);

create index idx_visitas_cola     on visitas (especialidad_asignada_id, estado, hora_llegada);
create index idx_visitas_paciente on visitas (paciente_id);
create index idx_visitas_llegada  on visitas (hora_llegada);

-- Un paciente solo puede tener una visita activa a la vez.
create unique index uq_visita_activa_paciente
  on visitas (paciente_id) where estado in ('espera', 'en_consulta');

create table visita_sintomas (
  visita_id      integer  not null references visitas (id) on delete cascade,
  sintoma_codigo text     not null references sintomas (codigo),
  intensidad     smallint not null check (intensidad between 1 and 5),
  duracion_dias  integer,
  primary key (visita_id, sintoma_codigo)
);

-- Explicación guardada: qué reglas dispararon para esta visita
create table visita_inferencias (
  id          integer generated always as identity primary key,
  visita_id   integer      not null references visitas (id) on delete cascade,
  regla_codigo text        not null,
  conclusion  text         not null,              -- 'especialidad:cardiologia' | 'hecho:sindrome_gripal'
  cf          numeric(4,3) not null,
  explicacion text         not null
);

-- ── Simulaciones guardadas ──────────────────────────────────────────────────
create table simulaciones (
  id           integer generated always as identity primary key,
  nombre       text        not null,
  creada_por   integer     references usuarios (id),
  parametros   jsonb       not null,
  resultados   jsonb       not null,
  linea_tiempo jsonb       not null default '[]'::jsonb,
  creado_en    timestamptz not null default now()
);
