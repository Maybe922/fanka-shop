import {
  Button,
  Card,
  Checkbox,
  Disclosure,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import { createArticle } from "@/app/admin/actions";

export function NewArticleForm() {
  return (
    <Card className="p-0">
      <Disclosure>
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left">
            <span>
              <span className="block text-sm font-semibold">新增教程</span>
              <span className="mt-1 block text-xs font-normal text-muted">
                每张卡片指向一个外部链接（如飞书文档），用户点卡片直接跳转查看教程。
              </span>
            </span>
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="px-5 pb-5">
            <form action={createArticle}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField name="title" isRequired className="sm:col-span-2">
                  <Label>标题</Label>
                  <Input placeholder="例如：ChatGPT Plus 卡密充值图文教程" />
                </TextField>
                <TextField
                  name="linkUrl"
                  type="url"
                  isRequired
                  className="sm:col-span-2"
                >
                  <Label>教程链接（飞书 / 文档外链，http(s) 开头）</Label>
                  <Input
                    className="font-mono"
                    placeholder="https://xxx.feishu.cn/docx/..."
                  />
                </TextField>
                <TextField name="tag" defaultValue="充值教程">
                  <Label>分类标签（卡片上显示）</Label>
                  <Input placeholder="充值教程 / 常见问题" />
                </TextField>
                <TextField name="sortOrder" type="number" defaultValue="0">
                  <Label>排序（小在前）</Label>
                  <Input />
                </TextField>
                <TextField name="summary" className="sm:col-span-2">
                  <Label>摘要（卡片上的简短说明）</Label>
                  <TextArea rows={2} placeholder="一句话概括这篇教程讲什么" />
                </TextField>
                <Checkbox
                  name="isPublished"
                  defaultSelected
                  className="sm:col-span-2"
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>立即发布（前台可见）</Label>
                  </Checkbox.Content>
                </Checkbox>
              </div>
              <Button type="submit" variant="primary" className="mt-5">
                添加教程
              </Button>
            </form>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}
