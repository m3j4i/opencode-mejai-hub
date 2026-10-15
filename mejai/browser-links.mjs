export function usefulLinks(items,filter=''){
 const unique=new Map();
 for(const item of items){
  try{
   const url=new URL(item.url),page=new URL(item.page);if(!['http:','https:'].includes(url.protocol))continue;
   const plain=new URL(url);plain.hash='';page.hash='';if(plain.href===page.href)continue;
   if(filter&&!(item.text+' '+url.href).toLowerCase().includes(filter.toLowerCase()))continue;
   const key=item.page+'\n'+url.href;
   if(!unique.has(key)||(!unique.get(key).text&&item.text))unique.set(key,item);
  }catch{}
 }
 return [...unique.values()];
}
