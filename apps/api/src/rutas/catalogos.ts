import type { FastifyInstance } from 'fastify';
import type { ConsultorioDto, EspecialidadDto, SintomaDto } from '@siarf/shared';
import type { Requerir } from '../auth/guardas';

/** Catálogos de solo lectura que necesitan las pantallas (cualquier usuario autenticado). */
export async function rutasCatalogos(app: FastifyInstance, requerir: Requerir) {
  const auth = { preHandler: requerir() };

  app.get('/especialidades', auth, async (): Promise<EspecialidadDto[]> => {
    const { rows } = await app.db.query<EspecialidadDto>(
      'select id, codigo, nombre from especialidades where activa order by nombre',
    );
    return rows;
  });

  app.get('/consultorios', auth, async (): Promise<ConsultorioDto[]> => {
    const { rows } = await app.db.query<{
      id: number;
      nombre: string;
      especialidad_id: number;
      especialidad_codigo: string;
    }>(
      `select c.id, c.nombre, c.especialidad_id, e.codigo as especialidad_codigo
         from consultorios c join especialidades e on e.id = c.especialidad_id
        where c.activo order by e.nombre, c.nombre`,
    );
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      especialidadId: r.especialidad_id,
      especialidadCodigo: r.especialidad_codigo,
    }));
  });

  app.get('/sintomas', auth, async (): Promise<SintomaDto[]> => {
    const { rows } = await app.db.query<SintomaDto>('select codigo, nombre, categoria from sintomas order by categoria, nombre');
    return rows;
  });
}
