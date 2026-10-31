import type { FastifyInstance } from 'fastify';
import { crearPacienteSchema, type PacienteDto } from '@siarf/shared';
import type { Requerir } from '../auth/guardas';
import { ErrorHttp, parsear, parsearId } from '../errores';
import { calcularEdad } from '../servicios/experto';

interface FilaPaciente {
  id: number;
  cedula: string;
  nombre: string;
  fecha_nacimiento: string;
  sexo: 'F' | 'M';
  telefono: string | null;
}

// Fuerza que `fecha_nacimiento` llegue como texto AAAA-MM-DD (sin zona horaria).
const COLUMNAS = `id, cedula, nombre, to_char(fecha_nacimiento, 'YYYY-MM-DD') as fecha_nacimiento, sexo, telefono`;

export function pacienteDto(f: FilaPaciente): PacienteDto {
  return {
    id: f.id,
    cedula: f.cedula,
    nombre: f.nombre,
    fechaNacimiento: f.fecha_nacimiento,
    sexo: f.sexo,
    telefono: f.telefono,
    edad: calcularEdad(f.fecha_nacimiento),
  };
}

export async function rutasPacientes(app: FastifyInstance, requerir: Requerir) {
  const auth = { preHandler: requerir('admin', 'recepcionista', 'doctor') };
  const registro = { preHandler: requerir('admin', 'recepcionista') };

  /** Búsqueda por cédula exacta o por nombre/cédula parcial (máx. 20 resultados). */
  app.get('/pacientes', auth, async (req): Promise<PacienteDto[]> => {
    const q = String((req.query as { q?: unknown } | undefined)?.q ?? '').trim();
    if (q.length < 2) return [];
    const normalizada = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const { rows } = await app.db.query<FilaPaciente>(
      `select ${COLUMNAS} from pacientes
        where ($1 <> '' and cedula like $1 || '%') or nombre ilike '%' || $2 || '%'
        order by nombre limit 20`,
      [normalizada, q],
    );
    return rows.map(pacienteDto);
  });

  app.get('/pacientes/:id', auth, async (req): Promise<PacienteDto> => {
    const id = parsearId(req.params);
    const { rows } = await app.db.query<FilaPaciente>(`select ${COLUMNAS} from pacientes where id = $1`, [id]);
    if (!rows[0]) throw new ErrorHttp(404, 'Paciente no encontrado');
    return pacienteDto(rows[0]);
  });

  app.post('/pacientes', registro, async (req, reply): Promise<PacienteDto> => {
    const d = parsear(crearPacienteSchema, req.body);
    const fecha = new Date(`${d.fechaNacimiento}T00:00:00Z`);
    if (Number.isNaN(fecha.getTime()) || fecha > new Date()) throw new ErrorHttp(400, 'Fecha de nacimiento inválida');

    try {
      const { rows } = await app.db.query<FilaPaciente>(
        `insert into pacientes (cedula, nombre, fecha_nacimiento, sexo, telefono)
         values ($1, $2, $3, $4, $5) returning ${COLUMNAS}`,
        [d.cedula, d.nombre, d.fechaNacimiento, d.sexo, d.telefono ?? null],
      );
      reply.code(201);
      return pacienteDto(rows[0]!);
    } catch (e) {
      if ((e as { code?: string })?.code === '23505') throw new ErrorHttp(409, 'Ya existe un paciente con esa cédula');
      throw e;
    }
  });
}
