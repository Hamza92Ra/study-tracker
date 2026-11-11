import { BookOpen, Brain, ChartNoAxesCombined, Code2, FlaskConical, Globe2, Languages, Music2, PenTool, Sigma } from 'lucide-react'
const icons = {book:BookOpen,brain:Brain,chart:ChartNoAxesCombined,code:Code2,flask:FlaskConical,globe:Globe2,language:Languages,music:Music2,pen:PenTool,calculator:Sigma}
export function SubjectIcon({name,className}:{name:string;className?:string}) { const Icon=icons[name as keyof typeof icons]??BookOpen;return <Icon className={className} size={20} strokeWidth={1.8}/> }
