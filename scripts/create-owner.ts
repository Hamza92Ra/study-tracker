import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { hash } from 'bcryptjs'
import { prisma } from '../src/lib/db'
async function hidden(prompt: string): Promise<string> {
  if (process.env.OWNER_PASSWORD) return process.env.OWNER_PASSWORD
  if (!stdin.isTTY || !stdin.setRawMode) throw new Error('Run interactively or provide OWNER_PASSWORD through your shell environment.')
  stdout.write(prompt); stdin.setRawMode(true); stdin.resume(); let value=''
  return await new Promise((resolve,reject)=>{ const onData=(chunk:Buffer)=>{const char=chunk.toString('utf8');if(char==='\r'||char==='\n'){stdin.setRawMode(false);stdin.off('data',onData);stdout.write('\n');resolve(value)}else if(char==='\u0003'){stdin.setRawMode(false);stdin.off('data',onData);reject(new Error('Cancelled'))}else if(char==='\u007f'){value=value.slice(0,-1)}else value+=char};stdin.on('data',onData) })
}
async function main(){if(await prisma.user.count())throw new Error('An owner already exists. Initial creation is single-owner only.');let username='',email='',displayName='';if(stdin.isTTY){const rl=createInterface({input:stdin,output:stdout});username=(await rl.question('Username: ')).trim().toLowerCase();email=(await rl.question('Email: ')).trim().toLowerCase();displayName=(await rl.question('Display name: ')).trim();rl.close()}else{let input='';for await(const chunk of stdin)input+=chunk.toString();[username,email,displayName]=input.split(/\r?\n/).map(x=>x.trim());username=username?.toLowerCase()||'';email=email?.toLowerCase()||'';displayName=displayName||'';}if(!/^[a-z0-9_-]{3,32}$/.test(username)||!/^\S+@\S+\.\S+$/.test(email)||!displayName)throw new Error('Provide a valid username, email and display name.');const password=await hidden('Password (at least 12 characters): ');if(password.length<12)throw new Error('Password must contain at least 12 characters.');const passwordHash=await hash(password,12);await prisma.user.create({data:{username,email,displayName,passwordHash,settings:{create:{timezone:'Africa/Casablanca',profileVisibility:'public',themePreference:'system'}},goal:{create:{dailyTargetMinutes:180}}}});stdout.write('Owner account created.\n')}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
