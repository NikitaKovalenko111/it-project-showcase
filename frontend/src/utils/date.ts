export function formatDate(value?:string|null):string {
 if(!value)return 'Не указан'
 const date=new Date(value)
 return Number.isNaN(date.getTime())?'Не указан':date.toLocaleDateString('ru-RU')
}
