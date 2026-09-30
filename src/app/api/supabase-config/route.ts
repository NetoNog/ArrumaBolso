import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const hasEnvConfig = Boolean(
    envUrl && 
    envKey && 
    !envUrl.includes('placeholder') && 
    envUrl.startsWith('https://')
  );

  return NextResponse.json({
    hasEnvConfig,
    url: hasEnvConfig ? envUrl : '',
    hasKey: hasEnvConfig,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, anonKey, writeToEnvFile } = body;

    if (!url || !anonKey) {
      return NextResponse.json(
        { success: false, error: 'URL do Supabase e Chave Anon são obrigatórias.' },
        { status: 400 }
      );
    }

    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = anonKey.trim();

    if (!cleanUrl.startsWith('https://')) {
      return NextResponse.json(
        { success: false, error: 'A URL do Supabase deve começar com https://' },
        { status: 400 }
      );
    }

    // Testa a conectividade usando supabase-js
    try {
      const testClient = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: false }
      });
      // Ping simples no endpoint de autenticação
      const { error } = await testClient.auth.getSession();
      if (error && error.message.includes('Invalid API key')) {
        return NextResponse.json(
          { success: false, error: 'Chave Anon inválida para este projeto Supabase.' },
          { status: 400 }
        );
      }
    } catch (testErr: any) {
      return NextResponse.json(
        { success: false, error: `Falha ao conectar no Supabase: ${testErr.message || 'Verifique a URL'}` },
        { status: 400 }
      );
    }

    // Se solicitado, salva no .env.local
    if (writeToEnvFile) {
      const rootDir = process.cwd();
      const envFilePath = path.join(rootDir, '.env.local');

      let content = '';
      if (fs.existsSync(envFilePath)) {
        content = fs.readFileSync(envFilePath, 'utf8');
      }

      // Substitui ou anexa as chaves
      if (content.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
        content = content.replace(/NEXT_PUBLIC_SUPABASE_URL=.*/g, `NEXT_PUBLIC_SUPABASE_URL=${cleanUrl}`);
      } else {
        content += `\nNEXT_PUBLIC_SUPABASE_URL=${cleanUrl}`;
      }

      if (content.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        content = content.replace(/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/g, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${cleanKey}`);
      } else {
        content += `\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${cleanKey}`;
      }

      fs.writeFileSync(envFilePath, content.trim() + '\n', 'utf8');
    }

    return NextResponse.json({
      success: true,
      message: 'Conexão com Supabase validada com sucesso!',
      savedToEnv: Boolean(writeToEnvFile)
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro interno ao validar configuração.' },
      { status: 500 }
    );
  }
}
